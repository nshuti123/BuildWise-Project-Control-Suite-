from django.contrib import admin
from .models import CustomUser, Announcement, AnnouncementAcknowledgment


@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('email', 'full_name', 'role', 'is_staff', 'is_active')
    search_fields = ('email', 'full_name')
    list_filter = ('role', 'is_staff', 'is_active')
    ordering = ('email',)


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ('title', 'audience_type', 'is_active', 'created_at', 'created_by')
    list_filter = ('audience_type', 'is_active')
    search_fields = ('title', 'body')


@admin.register(AnnouncementAcknowledgment)
class AnnouncementAcknowledgmentAdmin(admin.ModelAdmin):
    list_display = ('announcement', 'user', 'acknowledged_at')
