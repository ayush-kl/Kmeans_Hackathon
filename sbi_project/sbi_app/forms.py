from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from .models import SBIUser, UserEvent


class SBIUserRegistrationForm(UserCreationForm):
    """Form for user registration with Aadhaar number"""
    
    username = forms.CharField(
        max_length=150,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Username',
            'required': True
        })
    )
    
    first_name = forms.CharField(
        max_length=30,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'First Name'
        })
    )
    
    last_name = forms.CharField(
        max_length=30,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Last Name'
        })
    )
    
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'Email Address'
        })
    )
    
    phone_number = forms.CharField(
        max_length=15,
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Phone Number (Optional)'
        })
    )
    
    password1 = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Password'
        })
    )
    
    password2 = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Confirm Password'
        })
    )
    
    class Meta:
        model = SBIUser
        fields = ('username', 'aadhaar_number', 'first_name', 'last_name', 'email', 'phone_number', 'password1', 'password2')
    
    def clean_aadhaar_number(self):
        aadhaar = self.cleaned_data.get('aadhaar_number')
        if not aadhaar.isdigit():
            raise forms.ValidationError('Aadhaar number must contain only digits.')
        if len(aadhaar) != 12:
            raise forms.ValidationError('Aadhaar number must be exactly 12 digits.')
        return aadhaar


class SBILoginForm(AuthenticationForm):
    """Custom login form using username"""
    
    username = forms.CharField(
        max_length=150,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter your username',
            'autofocus': True
        }),
        label='Username'
    )
    
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Password'
        })
    )


class EventForm(forms.ModelForm):
    """Form for creating user events"""
    
    class Meta:
        model = UserEvent
        fields = ['event_type', 'latitude', 'longitude', 'location_accuracy']
        widgets = {
            'event_type': forms.Select(attrs={'class': 'form-control'}),
            'latitude': forms.HiddenInput(),
            'longitude': forms.HiddenInput(),
            'location_accuracy': forms.HiddenInput(),
        }


class AuthorityLoginForm(forms.Form):
    """Special form for authority login"""
    
    username = forms.CharField(
        max_length=150,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Authority Username',
            'autofocus': True
        })
    )
    
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Password'
        })
    )
