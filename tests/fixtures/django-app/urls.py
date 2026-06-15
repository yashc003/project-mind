from django.urls import path, re_path
from . import views

urlpatterns = [
    path('api/login', views.login_view),
    re_path(r'^api/users/(?P<id>[0-9]+)/$', views.user_detail),
]
