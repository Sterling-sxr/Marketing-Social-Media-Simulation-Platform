from django.contrib import admin

from .models import MediaAsset, Message, Notification


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "content", "created_at")
    ordering = ("-created_at",)
    search_fields = ("content",)


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ("id", "original_name", "content_type", "size", "uploaded_at")
    ordering = ("-uploaded_at",)
    search_fields = ("original_name", "content_type")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "recipient",
        "actor",
        "action",
        "subject",
        "is_read",
        "created_at",
    )
    list_filter = ("is_read", "action")
    search_fields = ("recipient", "actor", "subject")
