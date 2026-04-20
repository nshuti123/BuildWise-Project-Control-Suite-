from rest_framework import serializers
from .models import CustomUser, Notification, SystemLog, Message
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.exceptions import AuthenticationFailed

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username = attrs.get(self.username_field)
        if username:
            user = CustomUser.objects.filter(username=username).first()
            if user and not user.is_active:
                raise AuthenticationFailed("Your account has been deactivated. Please contact your administrator.", code="user_inactive")
                
        return super().validate(attrs)

class CustomUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = CustomUser
        fields = ('id', 'username', 'email', 'full_name', 'role', 'profile_picture', 'is_active', 'last_login', 'password')
        read_only_fields = ('last_login',)

    def create(self, validated_data):
        user = CustomUser.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            role=validated_data.get('role', 'site-engineer'),
            full_name=validated_data.get('full_name', '')
        )
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance

class RequestPasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()

class VerifyPasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6)
    new_password = serializers.CharField(write_only=True)

class SystemLogSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()

    class Meta:
        model = SystemLog
        fields = ('id', 'user', 'action', 'type', 'timestamp')

    def get_user(self, obj):
        if obj.user:
            return obj.user.full_name or obj.user.username
        return "System"

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'is_read', 'timestamp', 'link']

class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.full_name', read_only=True)
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    sender_email = serializers.EmailField(source='sender.email', read_only=True)
    recipient_name = serializers.CharField(source='recipient.full_name', read_only=True)
    recipient_username = serializers.CharField(source='recipient.username', read_only=True)
    recipient_email = serializers.EmailField(source='recipient.email', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'sender', 'sender_name', 'sender_username', 'sender_email', 'recipient', 'recipient_name', 'recipient_username', 'recipient_email', 'subject', 'body', 'is_read', 'is_urgent', 'timestamp']
        read_only_fields = ['sender', 'timestamp']
