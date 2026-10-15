from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def set_up_new_user(sender, instance, created, raw=False, **kwargs):
    """Accounts created outside sign-up (createsuperuser, Django admin) need a profile and categories too."""
    if created and not raw:
        from .defaults import setup_new_user

        setup_new_user(instance)
