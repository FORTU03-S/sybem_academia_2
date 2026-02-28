from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from academia.models import GradeChangeRequest, Grade
from django.utils.timezone import now

class NotificationCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if hasattr(user, 'school') and user.school:
            count = GradeChangeRequest.objects.filter(
                evaluation__teaching_assignment__classe__school=user.school,
                status='PENDING'
            ).count()
        else:
            count = 0
        return Response({'count': count})

class LatestNotificationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.school:
            return Response([])

        requests = GradeChangeRequest.objects.filter(
            evaluation__teaching_assignment__classe__school=user.school,
            status='PENDING'
        ).order_by('-created_at')[:10]

        data = []
        for r in requests:
            data.append({
                'id': r.id,
                'teacher_name': r.teacher.get_full_name() if hasattr(r, 'teacher') else "Enseignant",
                'student_name': r.enrollment.student.get_full_name() if r.enrollment.student else "Élève",
                'old_score': r.old_score,
                'new_score': r.new_score,
                'time_ago': "Récemment" 
            })
        
        return Response(data)

class ProcessNotificationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        action = request.data.get('action') 
        
        try:
            change_request = GradeChangeRequest.objects.get(
                pk=pk, 
                evaluation__teaching_assignment__classe__school=user.school,
                status='PENDING'
            )
            
            if action == 'approve':
                grade, _ = Grade.objects.get_or_create(
                    enrollment=change_request.enrollment, 
                    evaluation=change_request.evaluation
                )
                grade.score = change_request.new_score
                grade.save()
                change_request.status = 'APPROVED'
            
            elif action == 'reject':
                change_request.status = 'REJECTED'
            
            change_request.reviewed_at = now()
            change_request.reviewed_by = user
            change_request.save()
            
            return Response({'status': 'success'})

        except GradeChangeRequest.DoesNotExist:
            return Response({'error': 'Demande introuvable'}, status=404)