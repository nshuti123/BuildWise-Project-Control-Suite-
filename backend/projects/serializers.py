from rest_framework import serializers
from .models import Project, Task, Location, Milestone, PhaseTask
from users.serializers import CustomUserSerializer

class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = '__all__'

class ProjectSerializer(serializers.ModelSerializer):
    manager_details = CustomUserSerializer(source='manager', read_only=True)
    site_engineer_details = CustomUserSerializer(source='site_engineer', read_only=True)
    subcontractor_details = CustomUserSerializer(source='subcontractors', many=True, read_only=True)
    location_details = LocationSerializer(source='location', read_only=True)

    class Meta:
        model = Project
        fields = '__all__'
        read_only_fields = ('manager',)

class TaskSerializer(serializers.ModelSerializer):
    assigned_to_details = CustomUserSerializer(source='assigned_to', read_only=True)
    project_details = ProjectSerializer(source='project', read_only=True)

    class Meta:
        model = Task
        fields = '__all__'
        read_only_fields = ()

class MilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Milestone
        fields = '__all__'

class PhaseTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhaseTask
        fields = '__all__'
