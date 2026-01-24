from django.contrib import admin
from .models import BlogPost, YoutubeVideo

@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ('title', 'created_at')

@admin.register(YoutubeVideo)
class YoutubeVideoAdmin(admin.ModelAdmin):
    list_display = ('title', 'youtube_id', 'created_at')