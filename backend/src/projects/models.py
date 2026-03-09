from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Project(models.Model):
    """
    Модель проекта с базовыми полями и связью с чатами.
    """
    name = models.CharField(
        max_length=255,
        verbose_name="Название проекта"
    )
    description = models.TextField(
        blank=True,
        verbose_name="Описание проекта"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Дата создания"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Дата обновления"
    )
    
    # Связь с участниками проекта (опционально)
    members = models.ManyToManyField(
        User,
        related_name='projects',
        verbose_name="Участники проекта"
    )
    
    # Связь с создателем проекта
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_projects',
        verbose_name="Создатель проекта"
    )
    
    class Meta:
        verbose_name = "Проект"
        verbose_name_plural = "Проекты"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return self.name