from django.urls import path
from . import views

urlpatterns = [
    # Home and authentication
    path('', views.home, name='home'),
    path('register/', views.user_register, name='user_register'),
    path('login/', views.user_login, name='user_login'),
    path('authority/login/', views.authority_login, name='authority_login'),
    path('logout/', views.user_logout, name='logout'),
    
    # User dashboard
    path('dashboard/', views.user_dashboard, name='user_dashboard'),
    path('record-event/', views.record_event, name='record_event'),
    
    # Authority dashboard
    path('authority/', views.authority_dashboard, name='authority_dashboard'),
    path('authority/download/', views.download_data, name='download_data'),
    path('authority/process/', views.process_data, name='process_data'),
    path('authority/analysis/<int:analysis_id>/', views.view_analysis, name='view_analysis'),
    path('authority/analyses/', views.all_analyses, name='all_analyses'),
    
    # Location tracking features
    path('authority/find-user/', views.find_user_location, name='find_user_location'),
    path('authority/find-all/', views.find_all_locations, name='find_all_locations'),
    path('authority/export/<str:user_aadhaar>/', views.export_user_data, name='export_user_data'),
]
