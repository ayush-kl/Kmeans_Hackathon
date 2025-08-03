from django import template
from django.utils import timezone

# Try to use the modern zoneinfo (Python 3.9+), fallback to pytz
try:
    from zoneinfo import ZoneInfo
    def get_ist_timezone():
        return ZoneInfo('Asia/Kolkata')
    def make_aware_utc(naive_dt):
        return naive_dt.replace(tzinfo=timezone.utc)
except ImportError:
    # Fallback to pytz for older Python versions
    import pytz
    def get_ist_timezone():
        return pytz.timezone('Asia/Kolkata')
    def make_aware_utc(naive_dt):
        return pytz.utc.localize(naive_dt)

register = template.Library()

@register.filter
def ist_datetime(value):
    """Convert datetime to IST and format it nicely"""
    if not value:
        return ''
    
    # Convert to IST timezone
    ist_tz = get_ist_timezone()
    if timezone.is_aware(value):
        ist_time = value.astimezone(ist_tz)
    else:
        # If naive, assume it's UTC and make it aware
        utc_time = make_aware_utc(value)
        ist_time = utc_time.astimezone(ist_tz)
    
    # Format: "Dec 25, 15:30:45"
    return ist_time.strftime("%b %d, %H:%M:%S")

@register.filter  
def ist_date(value):
    """Convert datetime to IST date only"""
    if not value:
        return ''
    
    # Convert to IST timezone
    ist_tz = get_ist_timezone()
    if timezone.is_aware(value):
        ist_time = value.astimezone(ist_tz)
    else:
        # If naive, assume it's UTC and make it aware
        utc_time = make_aware_utc(value)
        ist_time = utc_time.astimezone(ist_tz)
    
    # Format: "Dec 25, 2025"
    return ist_time.strftime("%b %d, %Y")

@register.filter
def ist_time(value):
    """Convert datetime to IST time only"""
    if not value:
        return ''
    
    # Convert to IST timezone
    ist_tz = get_ist_timezone()
    if timezone.is_aware(value):
        ist_time = value.astimezone(ist_tz)
    else:
        # If naive, assume it's UTC and make it aware
        utc_time = make_aware_utc(value)
        ist_time = utc_time.astimezone(ist_tz)
    
    # Format: "3:30:45 PM"
    return ist_time.strftime("%I:%M:%S %p")

@register.filter
def ist_short(value):
    """Convert datetime to IST short format"""
    if not value:
        return ''
    
    # Convert to IST timezone
    ist_tz = get_ist_timezone()
    if timezone.is_aware(value):
        ist_time = value.astimezone(ist_tz)
    else:
        # If naive, assume it's UTC and make it aware
        utc_time = make_aware_utc(value)
        ist_time = utc_time.astimezone(ist_tz)
    
    # Format: "Dec 25, 15:30"
    return ist_time.strftime("%b %d, %H:%M")
