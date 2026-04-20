import psutil
import time
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView, ListAPIView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status, viewsets
from rest_framework.decorators import action
from .models import CustomUser, SystemLog, Notification, PasswordResetOTP, Message
from .serializers import CustomUserSerializer, CustomTokenObtainPairSerializer, SystemLogSerializer, NotificationSerializer, RequestPasswordResetSerializer, VerifyPasswordResetSerializer, MessageSerializer
from .permissions import IsAdmin
from rest_framework_simplejwt.views import TokenObtainPairView

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        serializer = CustomUserSerializer(user, context={"request": request})
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        serializer = CustomUserSerializer(user, data=request.data, partial=True, context={"request": request})
        if serializer.is_valid():
            # Prevent users from elevating their privileges
            if 'role' in serializer.validated_data and user.role != 'admin':
                serializer.validated_data.pop('role')
            if 'is_active' in serializer.validated_data and user.role != 'admin':
                serializer.validated_data.pop('is_active')
                
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserListView(ListCreateAPIView):
    queryset = CustomUser.objects.all().order_by('-date_joined')
    serializer_class = CustomUserSerializer
    
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdmin()]

class UserDetailView(RetrieveUpdateDestroyAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = CustomUserSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

import random
from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta

class RequestPasswordResetView(APIView):
    permission_classes = [] # Allow unauthenticated

    def post(self, request):
        serializer = RequestPasswordResetSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            user = CustomUser.objects.filter(email=email).first()
            if user:
                # Generate 6 digit OTP
                otp = str(random.randint(100000, 999999))
                # Delete old OTPs for this user
                PasswordResetOTP.objects.filter(user=user).delete()
                # Create new OTP
                PasswordResetOTP.objects.create(user=user, otp=otp)
                
                # Send email
                send_mail(
                    'BuildWise Password Reset',
                    f'Your password reset code is: {otp}\nThis code will expire in 15 minutes.',
                    'noreply@buildwise.com',
                    [email],
                    fail_silently=False,
                )
            
            # Always return success message to prevent email enumeration
            return Response({"detail": "If the email exists, a reset code has been sent."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class VerifyPasswordResetView(APIView):
    permission_classes = [] # Allow unauthenticated

    def post(self, request):
        serializer = VerifyPasswordResetSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            otp = serializer.validated_data['otp']
            new_password = serializer.validated_data['new_password']
            
            user = CustomUser.objects.filter(email=email).first()
            if not user:
                return Response({"detail": "Invalid email or OTP"}, status=status.HTTP_400_BAD_REQUEST)
                
            otp_obj = PasswordResetOTP.objects.filter(user=user, otp=otp).first()
            if not otp_obj:
                return Response({"detail": "Invalid email or OTP"}, status=status.HTTP_400_BAD_REQUEST)
                
            # Check expiration (15 minutes)
            if timezone.now() > otp_obj.created_at + timedelta(minutes=15):
                otp_obj.delete()
                return Response({"detail": "OTP has expired. Please request a new one."}, status=status.HTTP_400_BAD_REQUEST)
                
            # Reset password
            user.set_password(new_password)
            user.save()
            
            # Clean up used OTP
            otp_obj.delete()
            
            return Response({"detail": "Password has been successfully reset."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by('-timestamp')

    @action(detail=True, methods=['patch'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=['patch'])
    def mark_all_read(self, request):
        self.get_queryset().update(is_read=True)
        return Response({'status': 'All notifications marked as read'})

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Q
        return Message.objects.filter(
            Q(sender=self.request.user) | Q(recipient=self.request.user)
        ).order_by('-timestamp')

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)

    @action(detail=True, methods=['patch'])
    def mark_read(self, request, pk=None):
        msg = self.get_object()
        if msg.recipient == request.user:
            msg.is_read = True
            msg.save()
        return Response(MessageSerializer(msg).data)

class SystemLogListView(ListAPIView):
    queryset = SystemLog.objects.all().order_by('-timestamp')
    serializer_class = SystemLogSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

BOOT_TIME = psutil.boot_time()

class SystemMetricsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        import os
        
        # CPU
        cpu_percent = psutil.cpu_percent(interval=None)
        
        # CPU & Memory of the Buildwise App specifically
        process = psutil.Process(os.getpid())
        memory_used_mb = round(process.memory_info().rss / (1024 * 1024), 2)
        memory_usage_str = f"{memory_used_mb} MB"
        
        # Fallback to C: since it's Windows mostly
        disk_path = '/'
        if hasattr(psutil, 'WINDOWS') and psutil.WINDOWS:
             disk_path = 'C:\\'
        elif hasattr(psutil, 'os') and psutil.os.name == 'nt':
             disk_path = 'C:\\'
             
        disk = psutil.disk_usage(disk_path)
        disk_used_gb = round(disk.used / (1024**3), 2)
        disk_total_gb = round(disk.total / (1024**3), 2)
        disk_percent = disk.percent
        
        uptime_seconds = time.time() - BOOT_TIME
        uptime_hours = round(uptime_seconds / 3600, 2)
        
        return Response({
            "cpu_usage": f"{cpu_percent}%",
            "memory_usage": memory_usage_str,
            "uptime": f"{uptime_hours}h",
            "disk_used_gb": disk_used_gb,
            "disk_total_gb": disk_total_gb,
            "disk_percent": disk_percent,
        })
