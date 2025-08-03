from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.db.models import Count, Q
from django.core.paginator import Paginator
import json
import os
from datetime import datetime, timedelta
import subprocess
import sys
from zoneinfo import ZoneInfo

from .models import SBIUser, UserEvent, ProcessedData, EventWeight
from .forms import SBIUserRegistrationForm, SBILoginForm, AuthorityLoginForm
from .utils import process_kalman_cluster_fusion, convert_types


def format_timestamp_ist(dt):
    """Convert datetime to IST and return ISO format string"""
    if not dt:
        return None
    
    # Convert to IST timezone using zoneinfo
    ist_tz = ZoneInfo('Asia/Kolkata')
    if timezone.is_aware(dt):
        ist_time = dt.astimezone(ist_tz)
    else:
        # If naive, assume it's UTC and make it aware
        utc_time = dt.replace(tzinfo=ZoneInfo('UTC'))
        ist_time = utc_time.astimezone(ist_tz)
    
    return ist_time.isoformat()


def home(request):
    """Home page with login options"""
    return render(request, 'sbi_app/home.html')


def user_register(request):
    """User registration view"""
    if request.method == 'POST':
        form = SBIUserRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.is_defaulter = True  # All users are marked as defaulters
            user.save()
            messages.success(request, 'Registration successful! You can now login.')
            return redirect('user_login')
    else:
        form = SBIUserRegistrationForm()
    return render(request, 'sbi_app/register.html', {'form': form})


def user_login(request):
    """User login view"""
    if request.method == 'POST':
        form = SBILoginForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            if not user.is_authority:
                login(request, user)
                return redirect('user_dashboard')
            else:
                messages.error(request, 'Authorities should use the authority login page.')
    else:
        form = SBILoginForm()
    return render(request, 'sbi_app/user_login.html', {'form': form})


def authority_login(request):
    """Authority login view"""
    if request.method == 'POST':
        form = AuthorityLoginForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            
            # Check for superuser first
            if username == 'admin' and password == 'sbi123':
                try:
                    user = SBIUser.objects.get(username='admin')
                    login(request, user)
                    return redirect('authority_dashboard')
                except SBIUser.DoesNotExist:
                    messages.error(request, 'Admin user not found. Please run migrations first.')
            else:
                # Try to authenticate regular authority user
                user = authenticate(request, username=username, password=password)
                if user and user.is_authority:
                    login(request, user)
                    return redirect('authority_dashboard')
                else:
                    messages.error(request, 'Invalid credentials or not an authority user.')
    else:
        form = AuthorityLoginForm()
    return render(request, 'sbi_app/authority_login.html', {'form': form})


@login_required
def user_dashboard(request):
    """User dashboard with event buttons"""
    if request.user.is_authority:
        return redirect('authority_dashboard')
    
    # Get user's recent events
    recent_events = UserEvent.objects.filter(user=request.user).order_by('-timestamp')[:10]
    
    context = {
        'user': request.user,
        'recent_events': recent_events,
    }
    return render(request, 'sbi_app/user_dashboard.html', context)


@login_required
@csrf_exempt
@require_http_methods(["POST"])
def record_event(request):
    """API endpoint to record user events"""
    if request.user.is_authority:
        return JsonResponse({'error': 'Authorities cannot record events'}, status=403)
    
    try:
        data = json.loads(request.body)
        event_type = data.get('event_type')
        latitude = float(data.get('latitude', 0))
        longitude = float(data.get('longitude', 0))
        accuracy = float(data.get('accuracy', 0))
        
        # Validate event type
        valid_types = ['login', 'upi', 'app_open']
        if event_type not in valid_types:
            return JsonResponse({'error': 'Invalid event type'}, status=400)
        
        # Create event
        event = UserEvent.objects.create(
            user=request.user,
            event_type=event_type,
            latitude=latitude,
            longitude=longitude,
            location_accuracy=accuracy,
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        return JsonResponse({
            'success': True,
            'event_id': event.id,
            'message': f'{event_type.upper()} event recorded successfully!'
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def authority_dashboard(request):
    """Authority dashboard with data overview"""
    if not request.user.is_authority and not request.user.is_superuser:
        return redirect('user_dashboard')
    
    # Get statistics - exclude staff and authority users from total count
    total_users = SBIUser.objects.filter(is_staff=False, is_authority=False).count()
    total_events = UserEvent.objects.count()
    recent_events = UserEvent.objects.select_related('user').order_by('-timestamp')[:20]
    
    # Event type distribution
    event_stats = UserEvent.objects.values('event_type').annotate(count=Count('id'))
    
    # Recent activity (last 24 hours)
    last_24h = timezone.now() - timedelta(hours=24)
    recent_activity = UserEvent.objects.filter(timestamp__gte=last_24h).count()
    
    # Get recent processed analyses
    recent_analyses = ProcessedData.objects.all()[:5]
    
    context = {
        'total_users': total_users,
        'total_events': total_events,
        'recent_events': recent_events,
        'event_stats': event_stats,
        'recent_activity': recent_activity,
        'recent_analyses': recent_analyses,
    }
    return render(request, 'sbi_app/authority_dashboard.html', context)


@login_required
def download_data(request):
    """Download all user events as JSON"""
    if not request.user.is_authority and not request.user.is_superuser:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    # Get all events
    events = UserEvent.objects.select_related('user').all()
    
    # Convert to list of dictionaries
    data = []
    for event in events:
        data.append(event.to_dict())
    
    # Create JSON response
    response = HttpResponse(
        json.dumps(data, indent=2),
        content_type='application/json'
    )
    response['Content-Disposition'] = f'attachment; filename="sbi_events_{timezone.now().strftime("%Y%m%d_%H%M%S")}.json"'
    
    return response


@login_required
def process_data(request):
    """Process data using Kalman-Cluster Fusion algorithm"""
    if not request.user.is_authority and not request.user.is_superuser:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'error': 'Unauthorized', 'success': False}, status=403)
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    try:
        start_time = timezone.now()
        
        # Get all events
        events = UserEvent.objects.select_related('user').all()
        
        if not events.exists():
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'error': 'No events found to process.',
                    'success': False
                })
            messages.error(request, 'No events found to process.')
            return redirect('authority_dashboard')
        
        # Convert events to the format expected by the algorithm
        event_data = []
        for event in events:
            event_data.append(event.to_dict())
        
        # Save events to temporary file
        temp_file = f'temp_events_{timezone.now().strftime("%Y%m%d_%H%M%S")}.json'
        with open(temp_file, 'w') as f:
            json.dump(event_data, f, indent=2)
        
        # Process using Kalman-Cluster Fusion
        results = process_kalman_cluster_fusion(event_data)
        
        # Ensure all numpy types are converted for JSON serialization
        results = convert_types(results)
        
        # Calculate processing time
        processing_time = (timezone.now() - start_time).total_seconds()
        
        # Save processed results
        processed_data = ProcessedData.objects.create(
            total_events=len(event_data),
            total_users=len(set(e['user_id'] for e in event_data)),
            analysis_results=results,
            raw_data_file=temp_file
        )
        
        # Clean up temp file
        try:
            os.remove(temp_file)
        except:
            pass
        
        # Handle AJAX request
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({
                'success': True,
                'events_processed': len(event_data),
                'users_analyzed': len(set(e['user_id'] for e in event_data)),
                'processing_time': f'{processing_time:.2f}s',
                'clusters_found': results.get('total_clusters', 'N/A'),
                'anomalies': results.get('anomalies', 0),
                'confidence': results.get('confidence', 85),
                'analysis_id': processed_data.id,
                'results': results
            })
        
        messages.success(request, f'Data processed successfully! Analysis ID: {processed_data.id}')
        return redirect('view_analysis', analysis_id=processed_data.id)
        
    except Exception as e:
        error_msg = f'Error processing data: {str(e)}'
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({
                'error': error_msg,
                'success': False
            })
        messages.error(request, error_msg)
        return redirect('authority_dashboard')


@login_required
def view_analysis(request, analysis_id):
    """View processed analysis results"""
    if not request.user.is_authority and not request.user.is_superuser:
        return redirect('user_dashboard')
    
    analysis = get_object_or_404(ProcessedData, id=analysis_id)
    
    context = {
        'analysis': analysis,
        'results': analysis.analysis_results,
    }
    return render(request, 'sbi_app/analysis_results.html', context)


@login_required
def all_analyses(request):
    """View all processed analyses"""
    if not request.user.is_authority and not request.user.is_superuser:
        return redirect('user_dashboard')
    
    analyses = ProcessedData.objects.all().order_by('-processed_at')
    paginator = Paginator(analyses, 10)
    
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    context = {
        'page_obj': page_obj,
    }
    return render(request, 'sbi_app/all_analyses.html', context)


def user_logout(request):
    """Logout view"""
    logout(request)
    messages.success(request, 'You have been logged out successfully.')
    return redirect('home')


@login_required
def find_user_location(request):
    """Find location of a specific user using Kalman-Cluster algorithm"""
    if not request.user.is_authority and not request.user.is_superuser:
        return JsonResponse({'error': 'Unauthorized', 'success': False}, status=403)
    
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_identifier = data.get('user_identifier', '').strip()
            
            if not user_identifier:
                return JsonResponse({'error': 'User identifier is required', 'success': False})
            
            # Try to find user by Aadhaar, username, or email
            user = None
            try:
                # Try Aadhaar first
                if user_identifier.isdigit() and len(user_identifier) == 12:
                    user = SBIUser.objects.get(aadhaar_number=user_identifier)
                else:
                    # Try username or email
                    user = SBIUser.objects.get(
                        Q(username=user_identifier) | Q(email=user_identifier)
                    )
            except SBIUser.DoesNotExist:
                return JsonResponse({'error': 'User not found', 'success': False})
            
            # Get user's events
            events = UserEvent.objects.filter(user=user).order_by('-timestamp')
            
            if not events.exists():
                return JsonResponse({
                    'success': True,
                    'user_info': {
                        'name': f"{user.first_name} {user.last_name}",
                        'aadhaar': user.aadhaar_number,
                        'email': user.email,
                        'username': user.username
                    },
                    'message': 'No location events found for this user'
                })
            
            # Prepare events data for Kalman processing
            event_data = []
            for event in events:
                event_data.append({
                    'user_id': user.aadhaar_number,
                    'event_type': event.event_type,
                    'lat': float(event.latitude),
                    'lon': float(event.longitude),
                    'timestamp': format_timestamp_ist(event.timestamp),
                    'accuracy': float(event.location_accuracy)
                })
            
            # Process with Kalman-Cluster algorithm
            processed_results = process_kalman_cluster_fusion(event_data)
            processed_results = convert_types(processed_results)
            
            # Get processed location prediction
            user_prediction = None
            if 'location_predictions' in processed_results:
                user_prediction = processed_results['location_predictions'].get(user.aadhaar_number)
            
            # Prepare raw events data for display
            events_data = []
            for event in events[:50]:  # Limit to last 50 events
                events_data.append({
                    'id': event.id,
                    'event_type': event.event_type,
                    'latitude': float(event.latitude),
                    'longitude': float(event.longitude),
                    'accuracy': float(event.location_accuracy),
                    'timestamp': format_timestamp_ist(event.timestamp),
                    'ip_address': event.ip_address,
                    'user_agent': event.user_agent
                })
            
            response_data = {
                'success': True,
                'user_info': {
                    'name': f"{user.first_name} {user.last_name}",
                    'aadhaar': user.aadhaar_number,
                    'email': user.email,
                    'username': user.username,
                    'is_defaulter': user.is_defaulter
                },
                'events': events_data,
                'total_events': events.count(),
                'kalman_processing': processed_results if 'error' not in processed_results else None,
                'processing_error': processed_results.get('error') if 'error' in processed_results else None
            }
            
            # Add predicted location if available
            if user_prediction:
                response_data['predicted_location'] = {
                    'latitude': user_prediction['predicted_lat'],
                    'longitude': user_prediction['predicted_lon'],
                    'confidence': user_prediction['confidence'],
                    'cluster_id': user_prediction.get('cluster_id'),
                    'prediction_type': user_prediction.get('prediction_type', 'cluster_based'),
                    'event_count_used': user_prediction.get('event_count', 0),
                    'timestamp': user_prediction.get('timestamp')
                }
            
            # Add latest raw location for comparison
            if events:
                response_data['latest_raw_location'] = {
                    'latitude': float(events.first().latitude),
                    'longitude': float(events.first().longitude),
                    'timestamp': format_timestamp_ist(events.first().timestamp),
                    'event_type': events.first().event_type,
                    'accuracy': float(events.first().location_accuracy)
                }
            
            return JsonResponse(response_data)
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON data', 'success': False})
        except Exception as e:
            return JsonResponse({'error': str(e), 'success': False})
    
    return JsonResponse({'error': 'Only POST method allowed', 'success': False})


@login_required
def find_all_locations(request):
    """Find locations of all users using Kalman-Cluster algorithm"""
    if not request.user.is_authority and not request.user.is_superuser:
        return JsonResponse({'error': 'Unauthorized', 'success': False}, status=403)
    
    try:
        # Get all regular users (exclude staff, authority, and superusers)
        users = SBIUser.objects.filter(is_staff=False, is_authority=False, is_superuser=False)
        
        # Collect all event data for processing
        all_event_data = []
        user_event_counts = {}
        
        for user in users:
            events = UserEvent.objects.filter(user=user).order_by('-timestamp')
            user_event_counts[user.aadhaar_number] = events.count()
            
            for event in events:
                all_event_data.append({
                    'user_id': user.aadhaar_number,
                    'event_type': event.event_type,
                    'lat': float(event.latitude),
                    'lon': float(event.longitude),
                    'timestamp': format_timestamp_ist(event.timestamp),
                    'accuracy': float(event.location_accuracy)
                })
        
        # Process all data with Kalman-Cluster algorithm
        processed_results = {}
        processing_error = None
        
        if all_event_data:
            try:
                processed_results = process_kalman_cluster_fusion(all_event_data)
                processed_results = convert_types(processed_results)
                if 'error' in processed_results:
                    processing_error = processed_results['error']
                    processed_results = {}
            except Exception as e:
                processing_error = str(e)
        
        # Prepare user data with predictions
        users_data = []
        
        for user in users:
            latest_event = UserEvent.objects.filter(user=user).order_by('-timestamp').first()
            
            user_info = {
                'aadhaar': user.aadhaar_number,
                'name': f"{user.first_name} {user.last_name}",
                'username': user.username,
                'email': user.email,
                'is_defaulter': user.is_defaulter,
                'total_events': user_event_counts.get(user.aadhaar_number, 0)
            }
            
            # Add raw latest location
            if latest_event:
                user_info['latest_raw_location'] = {
                    'latitude': float(latest_event.latitude),
                    'longitude': float(latest_event.longitude),
                    'accuracy': float(latest_event.location_accuracy),
                    'timestamp': format_timestamp_ist(latest_event.timestamp),
                    'event_type': latest_event.event_type
                }
            else:
                user_info['latest_raw_location'] = None
            
            # Add Kalman prediction if available
            if processed_results and 'location_predictions' in processed_results:
                user_prediction = processed_results['location_predictions'].get(user.aadhaar_number)
                if user_prediction:
                    user_info['predicted_location'] = {
                        'latitude': user_prediction['predicted_lat'],
                        'longitude': user_prediction['predicted_lon'],
                        'confidence': user_prediction['confidence'],
                        'cluster_id': user_prediction.get('cluster_id'),
                        'prediction_type': user_prediction.get('prediction_type', 'cluster_based'),
                        'event_count_used': user_prediction.get('event_count', 0),
                        'timestamp': user_prediction.get('timestamp')
                    }
                else:
                    user_info['predicted_location'] = None
            else:
                user_info['predicted_location'] = None
            
            users_data.append(user_info)
        
        response_data = {
            'success': True,
            'users': users_data,
            'total_users': len(users_data),
            'users_with_raw_location': len([u for u in users_data if u['latest_raw_location']]),
            'users_with_predictions': len([u for u in users_data if u['predicted_location']]),
            'processing_summary': processed_results.get('summary') if processed_results else None,
            'cluster_info': processed_results.get('cluster_info') if processed_results else None,
            'processing_error': processing_error
        }
        
        return JsonResponse(response_data)
        
    except Exception as e:
        return JsonResponse({'error': str(e), 'success': False})


@login_required
def export_user_data(request, user_aadhaar):
    """Export specific user's data"""
    if not request.user.is_authority and not request.user.is_superuser:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    try:
        user = get_object_or_404(SBIUser, aadhaar_number=user_aadhaar)
        events = UserEvent.objects.filter(user=user).order_by('-timestamp')
        
        # Prepare export data
        export_data = {
            'user_info': {
                'aadhaar': user.aadhaar_number,
                'name': f"{user.first_name} {user.last_name}",
                'email': user.email,
                'username': user.username,
                'phone': user.phone_number,
                'is_defaulter': user.is_defaulter,
                'created_at': user.created_at.isoformat(),
                'total_events': events.count()
            },
            'events': [event.to_dict() for event in events],
            'export_timestamp': format_timestamp_ist(timezone.now())
        }
        
        # Create JSON response
        response = HttpResponse(
            json.dumps(export_data, indent=2),
            content_type='application/json'
        )
        response['Content-Disposition'] = f'attachment; filename="user_{user_aadhaar}_data_{timezone.now().strftime("%Y%m%d_%H%M%S")}.json"'
        
        return response
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
