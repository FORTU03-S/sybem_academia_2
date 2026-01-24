from rest_framework import serializers
from .models import BlogPost, YoutubeVideo

class BlogPostSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlogPost
        fields = '__all__'

class YoutubeVideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = YoutubeVideo
        fields = '__all__'