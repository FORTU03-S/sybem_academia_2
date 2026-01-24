from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BlogPostViewSet, YoutubeVideoViewSet
from . import views

router = DefaultRouter()
router.register(r'posts', BlogPostViewSet)
router.register(r'videos', YoutubeVideoViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('<int:pk>/', views.blog_detail, name='blog-detail'),
]