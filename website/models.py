from django.db import models

class BlogPost(models.Model):
    title = models.CharField(max_length=200)
    image = models.ImageField(upload_to='blog_images/')
    content = models.TextField() # Contenu HTML ou texte
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class YoutubeVideo(models.Model):
    title = models.CharField(max_length=200)
    youtube_id = models.CharField(max_length=50, help_text="L'ID de la vidéo (ex: dQw4w9WgXcQ)")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title