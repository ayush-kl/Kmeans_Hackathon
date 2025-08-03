from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.shortcuts import render, redirect
from django.contrib import messages
from django.urls import path
from django.http import HttpResponseRedirect
from django.utils.html import format_html
from django.contrib.admin import AdminSite
from .models import SBIUser, UserEvent, ProcessedData, EventWeight


# Custom Admin Site with additional functionality
class SBIAdminSite(AdminSite):
    site_header = "SBI Application Administration"
    site_title = "SBI Admin"
    index_title = "Welcome to SBI Administration Panel"
    
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('clear-all-data/', self.admin_view(self.clear_all_data_view), name='clear_all_data'),
        ]
        return custom_urls + urls
    
    def clear_all_data_view(self, request):
        if request.method == 'POST':
            # Count records before deletion
            user_count = SBIUser.objects.filter(is_superuser=False, is_authority=False).count()
            event_count = UserEvent.objects.count()
            processed_count = ProcessedData.objects.count()
            
            # Delete data
            SBIUser.objects.filter(is_superuser=False, is_authority=False).delete()
            UserEvent.objects.all().delete()
            ProcessedData.objects.all().delete()
            
            messages.success(request, f'Successfully cleared all data: {user_count} users, {event_count} events, {processed_count} processed records.')
            return redirect('/admin/')
        
        context = {
            'title': 'Clear All Application Data',
            'user_count': SBIUser.objects.filter(is_superuser=False, is_authority=False).count(),
            'event_count': UserEvent.objects.count(),
            'processed_count': ProcessedData.objects.count(),
        }
        return render(request, 'admin/clear_all_data.html', context)

# Use custom admin site
admin_site = SBIAdminSite(name='sbi_admin')


@admin.register(SBIUser)
class SBIUserAdmin(UserAdmin):
    list_display = ('aadhaar_number', 'first_name', 'last_name', 'email', 'is_authority', 'is_defaulter', 'created_at', 'admin_actions')
    list_filter = ('is_authority', 'is_defaulter', 'is_active', 'created_at')
    search_fields = ('aadhaar_number', 'first_name', 'last_name', 'email')
    ordering = ('-created_at',)
    actions = ['delete_selected_users', 'mark_as_defaulter', 'mark_as_regular']
    
    fieldsets = (
        (None, {'fields': ('aadhaar_number', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name', 'email', 'phone_number')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'is_authority', 'is_defaulter', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('aadhaar_number', 'first_name', 'last_name', 'email', 'password1', 'password2', 'is_authority', 'is_defaulter'),
        }),
    )

    def admin_actions(self, obj):
        return format_html(
            '<a class="button" href="{}">Delete User</a>',
            f'/admin/sbi_app/sbiuser/{obj.pk}/delete/'
        )
    admin_actions.short_description = 'Actions'
    admin_actions.allow_tags = True

    def delete_selected_users(self, request, queryset):
        count = queryset.count()
        queryset.delete()
        messages.success(request, f'Successfully deleted {count} users.')
    delete_selected_users.short_description = "Delete selected users"

    def mark_as_defaulter(self, request, queryset):
        count = queryset.update(is_defaulter=True)
        messages.success(request, f'Marked {count} users as defaulters.')
    mark_as_defaulter.short_description = "Mark as defaulter"

    def mark_as_regular(self, request, queryset):
        count = queryset.update(is_defaulter=False)
        messages.success(request, f'Marked {count} users as regular.')
    mark_as_regular.short_description = "Mark as regular"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('delete-all-users/', self.admin_site.admin_view(self.delete_all_users), name='delete_all_users'),
        ]
        return custom_urls + urls

    def delete_all_users(self, request):
        if request.method == 'POST':
            # Keep superusers and authority users
            count = SBIUser.objects.filter(is_superuser=False, is_authority=False).count()
            SBIUser.objects.filter(is_superuser=False, is_authority=False).delete()
            messages.success(request, f'Deleted {count} regular users. Superusers and authority users preserved.')
            return redirect('/admin/sbi_app/sbiuser/')
        return render(request, 'admin/confirm_delete_all.html', {'model_name': 'Users'})


@admin.register(UserEvent)
class UserEventAdmin(admin.ModelAdmin):
    list_display = ('user', 'event_type', 'timestamp', 'latitude', 'longitude', 'location_accuracy', 'admin_actions')
    list_filter = ('event_type', 'timestamp', 'user__is_defaulter')
    search_fields = ('user__aadhaar_number', 'user__first_name', 'user__last_name', 'event_type')
    ordering = ('-timestamp',)
    readonly_fields = ('timestamp',)
    actions = ['delete_selected_events', 'delete_old_events']

    def admin_actions(self, obj):
        return format_html(
            '<a class="button" href="{}">Delete Event</a>',
            f'/admin/sbi_app/userevent/{obj.pk}/delete/'
        )
    admin_actions.short_description = 'Actions'
    admin_actions.allow_tags = True

    def delete_selected_events(self, request, queryset):
        count = queryset.count()
        queryset.delete()
        messages.success(request, f'Successfully deleted {count} events.')
    delete_selected_events.short_description = "Delete selected events"

    def delete_old_events(self, request, queryset):
        from datetime import datetime, timedelta
        from django.utils import timezone
        cutoff_date = timezone.now() - timedelta(days=30)
        count = UserEvent.objects.filter(timestamp__lt=cutoff_date).count()
        UserEvent.objects.filter(timestamp__lt=cutoff_date).delete()
        messages.success(request, f'Deleted {count} events older than 30 days.')
    delete_old_events.short_description = "Delete events older than 30 days"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('delete-all-events/', self.admin_site.admin_view(self.delete_all_events), name='delete_all_events'),
        ]
        return custom_urls + urls

    def delete_all_events(self, request):
        if request.method == 'POST':
            count = UserEvent.objects.count()
            UserEvent.objects.all().delete()
            messages.success(request, f'Deleted all {count} events.')
            return redirect('/admin/sbi_app/userevent/')
        return render(request, 'admin/confirm_delete_all.html', {'model_name': 'Events'})


@admin.register(ProcessedData)
class ProcessedDataAdmin(admin.ModelAdmin):
    list_display = ('id', 'processed_at', 'total_events', 'total_users', 'raw_data_file', 'admin_actions')
    list_filter = ('processed_at',)
    ordering = ('-processed_at',)
    readonly_fields = ('processed_at',)
    actions = ['delete_selected_data', 'delete_old_data']

    def admin_actions(self, obj):
        return format_html(
            '<a class="button" href="{}">Delete Data</a>',
            f'/admin/sbi_app/processeddata/{obj.pk}/delete/'
        )
    admin_actions.short_description = 'Actions'
    admin_actions.allow_tags = True

    def delete_selected_data(self, request, queryset):
        count = queryset.count()
        queryset.delete()
        messages.success(request, f'Successfully deleted {count} processed data records.')
    delete_selected_data.short_description = "Delete selected processed data"

    def delete_old_data(self, request, queryset):
        from datetime import datetime, timedelta
        from django.utils import timezone
        cutoff_date = timezone.now() - timedelta(days=7)
        count = ProcessedData.objects.filter(processed_at__lt=cutoff_date).count()
        ProcessedData.objects.filter(processed_at__lt=cutoff_date).delete()
        messages.success(request, f'Deleted {count} processed data records older than 7 days.')
    delete_old_data.short_description = "Delete processed data older than 7 days"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('delete-all-processed/', self.admin_site.admin_view(self.delete_all_processed), name='delete_all_processed'),
        ]
        return custom_urls + urls

    def delete_all_processed(self, request):
        if request.method == 'POST':
            count = ProcessedData.objects.count()
            ProcessedData.objects.all().delete()
            messages.success(request, f'Deleted all {count} processed data records.')
            return redirect('/admin/sbi_app/processeddata/')
        return render(request, 'admin/confirm_delete_all.html', {'model_name': 'Processed Data'})


@admin.register(EventWeight)
class EventWeightAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'weight', 'description')
    list_editable = ('weight',)
    ordering = ('event_type',)


# Register models with both default admin and custom admin
admin_site.register(SBIUser, SBIUserAdmin)
admin_site.register(UserEvent, UserEventAdmin)
admin_site.register(ProcessedData, ProcessedDataAdmin)
admin_site.register(EventWeight, EventWeightAdmin)
