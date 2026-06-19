from django.http import JsonResponse
from rest_framework.decorators import api_view

@api_view(['GET'])
def user_list(request):
    return JsonResponse({"users": [{"id": 1, "name": "Alice"}]})
