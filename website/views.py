from rest_framework import viewsets
from .models import BlogPost, YoutubeVideo
from .serializers import BlogPostSerializer, YoutubeVideoSerializer
from rest_framework import permissions
from django.shortcuts import render, get_object_or_404
from .models import BlogPost

class BlogPostViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = BlogPost.objects.all().order_by('-created_at')
    serializer_class = BlogPostSerializer
    permission_classes = [permissions.AllowAny]

class YoutubeVideoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = YoutubeVideo.objects.all().order_by('-created_at')
    serializer_class = YoutubeVideoSerializer
    permission_classes = [permissions.AllowAny]
    
def blog_detail(request, pk):
    post = get_object_or_404(BlogPost, pk=pk)
    return render(request, 'blog_detail.html', {'post': post})

def perform_create(self, serializer):
        
        serializer.save(
            created_by=self.request.user,
            is_approved=False  
        )
        
        