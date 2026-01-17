from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from academia.models import GradeChangeRequest, Grade
from django.utils.timezone import now

# 1. Compteur pour le badge rouge
class NotificationCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Ton modèle utilise simplement .school
        if hasattr(user, 'school') and user.school:
            count = GradeChangeRequest.objects.filter(
                evaluation__teaching_assignment__classe__school=user.school,
                status='PENDING'
            ).count()
        else:
            count = 0
        return Response({'count': count})

# 2. Liste des dernières demandes pour le panneau latéral
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

        # On formate manuellement pour le JS
        data = []
        for r in requests:
            data.append({
                'id': r.id,
                'teacher_name': r.teacher.get_full_name() if hasattr(r, 'teacher') else "Enseignant",
                'student_name': r.enrollment.student.get_full_name() if r.enrollment.student else "Élève",
                'old_score': r.old_score,
                'new_score': r.new_score,
                'time_ago': "Récemment" # Tu pourras améliorer ça avec timesince plus tard
            })
        
        return Response(data)

# 3. Traiter une demande (Approuver/Refuser)
class ProcessNotificationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        action = request.data.get('action') # 'approve' ou 'reject'
        
        try:
            # Filtrage par l'école de l'admin
            change_request = GradeChangeRequest.objects.get(
                pk=pk, 
                evaluation__teaching_assignment__classe__school=user.school,
                status='PENDING'
            )
            
            if action == 'approve':
                # Mise à jour de la note réelle
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