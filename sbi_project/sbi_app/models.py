from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
import json


class SBIUser(AbstractUser):
    """Custom user model with Aadhaar as primary identifier"""
    
    # Override username to be unique and required
    username = models.CharField(max_length=150, unique=True)
    
    # Aadhaar number as primary key (12 digits)
    aadhaar_validator = RegexValidator(
        regex=r'^\d{12}$',
        message='Aadhaar number must be exactly 12 digits'
    )
    aadhaar_number = models.CharField(
        max_length=12,
        unique=True,
        primary_key=True,
        validators=[aadhaar_validator],
        help_text='12-digit Aadhaar number'
    )
    
    # Additional user fields
    phone_number = models.CharField(max_length=15, blank=True)
    is_authority = models.BooleanField(default=False, help_text='Is this user an SBI Authority?')
    is_defaulter = models.BooleanField(default=True, help_text='Mark as defaulter for tracking')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Use aadhaar_number as the login field instead of username
    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['aadhaar_number', 'email', 'first_name', 'last_name']
    
    class Meta:
        verbose_name = 'SBI User'
        verbose_name_plural = 'SBI Users'
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.aadhaar_number})"
    
    def save(self, *args, **kwargs):
        # Set username to aadhaar_number if not provided
        if not self.username:
            self.username = self.aadhaar_number
        super().save(*args, **kwargs)


class UserEvent(models.Model):
    """Model to store user events for tracking"""
    
    EVENT_TYPES = [
        ('login', 'SBI Login'),
        ('upi', 'UPI Transaction'),
        ('app_open', 'App Open'),
    ]
    
    user = models.ForeignKey(SBIUser, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    timestamp = models.DateTimeField(auto_now_add=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    location_accuracy = models.FloatField(default=0.0, help_text='GPS accuracy in meters')
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'User Event'
        verbose_name_plural = 'User Events'
    
    def __str__(self):
        return f"{self.user.aadhaar_number} - {self.event_type} at {self.timestamp}"
    
    def to_dict(self):
        """Convert event to dictionary for JSON export"""
        return {
            'user_id': self.user.aadhaar_number,
            'is_defaulter': self.user.is_defaulter,
            'event_type': self.event_type,
            'timestamp': self.timestamp.isoformat(),
            'lat': self.latitude,
            'lon': self.longitude,
            'accuracy': self.location_accuracy,
            'ip_address': self.ip_address,
        }


class ProcessedData(models.Model):
    """Model to store processed analysis results"""
    
    processed_at = models.DateTimeField(auto_now_add=True)
    total_events = models.IntegerField()
    total_users = models.IntegerField()
    analysis_results = models.JSONField(default=dict)
    raw_data_file = models.CharField(max_length=255, blank=True)
    
    class Meta:
        ordering = ['-processed_at']
        verbose_name = 'Processed Data'
        verbose_name_plural = 'Processed Data'
    
    def __str__(self):
        return f"Analysis {self.id} - {self.processed_at.strftime('%Y-%m-%d %H:%M')}"


class EventWeight(models.Model):
    """Model to store event weights for analysis"""
    
    event_type = models.CharField(max_length=20, unique=True)
    weight = models.FloatField()
    description = models.TextField(blank=True)
    
    class Meta:
        verbose_name = 'Event Weight'
        verbose_name_plural = 'Event Weights'
    
    def __str__(self):
        return f"{self.event_type}: {self.weight}"
