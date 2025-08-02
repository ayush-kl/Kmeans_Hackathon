from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
import pytz
from sbi_app.models import SBIUser, UserEvent, ProcessedData


def format_timestamp_ist(dt):
    """Convert datetime to IST and return formatted string"""
    if not dt:
        return None
    
    # Convert to IST timezone
    ist_tz = pytz.timezone('Asia/Kolkata')
    if timezone.is_aware(dt):
        ist_time = dt.astimezone(ist_tz)
    else:
        # If naive, assume it's UTC and make it aware
        utc_time = pytz.utc.localize(dt)
        ist_time = utc_time.astimezone(ist_tz)
    
    return ist_time.strftime("%Y-%m-%d %H:%M:%S IST")


class Command(BaseCommand):
    help = 'Clear application data with various options'

    def add_arguments(self, parser):
        parser.add_argument(
            '--all',
            action='store_true',
            help='Delete all application data (preserves admin/authority users)',
        )
        parser.add_argument(
            '--users',
            action='store_true',
            help='Delete regular users only (preserves admin/authority)',
        )
        parser.add_argument(
            '--events',
            action='store_true',
            help='Delete all user events',
        )
        parser.add_argument(
            '--processed',
            action='store_true',
            help='Delete all processed data',
        )
        parser.add_argument(
            '--old',
            action='store_true',
            help='Delete old data (events > 30 days, processed > 7 days)',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Skip confirmation prompts',
        )

    def handle(self, *args, **options):
        if not any([options['all'], options['users'], options['events'], 
                   options['processed'], options['old']]):
            self.stdout.write(
                self.style.ERROR('Please specify what to delete: --all, --users, --events, --processed, or --old')
            )
            return

        # Confirmation unless --force is used
        if not options['force']:
            confirm = input('Are you sure you want to proceed? This action cannot be undone. (yes/no): ')
            if confirm.lower() not in ['yes', 'y']:
                self.stdout.write(self.style.WARNING('Operation cancelled.'))
                return

        deleted_counts = {
            'users': 0,
            'events': 0,
            'processed': 0
        }

        # Delete all data
        if options['all']:
            deleted_counts['users'] = SBIUser.objects.filter(
                is_superuser=False, is_authority=False
            ).count()
            deleted_counts['events'] = UserEvent.objects.count()
            deleted_counts['processed'] = ProcessedData.objects.count()
            
            SBIUser.objects.filter(is_superuser=False, is_authority=False).delete()
            UserEvent.objects.all().delete()
            ProcessedData.objects.all().delete()
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully cleared all data:\n'
                    f'- Users: {deleted_counts["users"]}\n'
                    f'- Events: {deleted_counts["events"]}\n'
                    f'- Processed: {deleted_counts["processed"]}'
                )
            )

        # Delete users only
        elif options['users']:
            deleted_counts['users'] = SBIUser.objects.filter(
                is_superuser=False, is_authority=False
            ).count()
            SBIUser.objects.filter(is_superuser=False, is_authority=False).delete()
            self.stdout.write(
                self.style.SUCCESS(f'Deleted {deleted_counts["users"]} regular users.')
            )

        # Delete events only
        elif options['events']:
            deleted_counts['events'] = UserEvent.objects.count()
            UserEvent.objects.all().delete()
            self.stdout.write(
                self.style.SUCCESS(f'Deleted {deleted_counts["events"]} events.')
            )

        # Delete processed data only
        elif options['processed']:
            deleted_counts['processed'] = ProcessedData.objects.count()
            ProcessedData.objects.all().delete()
            self.stdout.write(
                self.style.SUCCESS(f'Deleted {deleted_counts["processed"]} processed data records.')
            )

        # Delete old data
        elif options['old']:
            now = timezone.now()
            event_cutoff = now - timedelta(days=30)
            processed_cutoff = now - timedelta(days=7)
            
            deleted_counts['events'] = UserEvent.objects.filter(
                timestamp__lt=event_cutoff
            ).count()
            deleted_counts['processed'] = ProcessedData.objects.filter(
                processed_at__lt=processed_cutoff
            ).count()
            
            UserEvent.objects.filter(timestamp__lt=event_cutoff).delete()
            ProcessedData.objects.filter(processed_at__lt=processed_cutoff).delete()
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Cleaned old data:\n'
                    f'- Events older than 30 days: {deleted_counts["events"]}\n'
                    f'- Processed data older than 7 days: {deleted_counts["processed"]}'
                )
            )

        self.stdout.write(
            self.style.WARNING(
                'Note: Superuser and authority accounts were preserved.'
            )
        )
