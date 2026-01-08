from django.apps import AppConfig
class PupilsConfig(AppConfig):
    name = "pupils"

    def ready(self):
        import pupils.signals.student_signals
