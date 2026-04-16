from __future__ import annotations

import os

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile

from ..repositories.models import Course, CourseMaterial, CourseMember

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".ppt", ".pptx",
    ".xls", ".xlsx", ".txt", ".md",
    ".png", ".jpg", ".jpeg", ".gif", ".webp",
    ".zip", ".rar", ".7z",
    ".mp4", ".mov",
}

CATEGORY_CHOICES = {"lecture", "tutorial", "assignment", "reading", "exam", "other"}


def _get_course_or_raise(course_id: int) -> Course:
    try:
        return Course.objects.get(pk=course_id)
    except Course.DoesNotExist:
        raise ValueError(f"Course {course_id} not found.")


def _is_course_member(user, course_id: int) -> bool:
    return CourseMember.objects.filter(course_id=course_id, user=user).exists()


def _is_teacher_or_admin(user, course_id: int) -> bool:
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True
    return CourseMember.objects.filter(
        course_id=course_id, user=user, role="teacher"
    ).exists()


def list_course_materials(user, course_id: int, category: str | None = None) -> list[dict]:
    if not _is_course_member(user, course_id):
        if not (getattr(user, "is_superuser", False) or getattr(user, "is_staff", False)):
            raise PermissionError("You are not a member of this course.")

    qs = CourseMaterial.objects.filter(
        course_id=course_id, is_visible=True
    ).select_related("uploaded_by")

    if category and category in CATEGORY_CHOICES:
        qs = qs.filter(category=category)

    return [_serialize(m) for m in qs]


def upload_course_material(
    user,
    course_id: int,
    title: str,
    description: str,
    category: str,
    uploaded_file: UploadedFile,
) -> dict:
    if not _is_teacher_or_admin(user, course_id):
        raise PermissionError("Only teachers or admins can upload materials.")

    _get_course_or_raise(course_id)

    # Validate title
    title = title.strip()
    if not title:
        raise ValidationError("Title is required.")

    # Validate file size
    if uploaded_file.size > MAX_FILE_SIZE:
        raise ValidationError(
            f"File size exceeds the 50 MB limit ({uploaded_file.size // (1024 * 1024)} MB)."
        )

    # Validate extension
    _, ext = os.path.splitext(uploaded_file.name or "")
    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise ValidationError(
            f"File type '{ext}' is not allowed. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Validate category
    if category not in CATEGORY_CHOICES:
        category = "other"

    material = CourseMaterial(
        course_id=course_id,
        title=title,
        description=description.strip(),
        category=category,
        file=uploaded_file,
        original_name=uploaded_file.name,
        content_type=getattr(uploaded_file, "content_type", "") or "",
        size=uploaded_file.size,
        uploaded_by=user,
    )
    material.save()
    return _serialize(material)


def delete_course_material(user, course_id: int, material_id: int) -> None:
    try:
        material = CourseMaterial.objects.get(pk=material_id, course_id=course_id)
    except CourseMaterial.DoesNotExist:
        raise ValueError("Material not found.")

    is_uploader = material.uploaded_by_id == user.pk
    if not is_uploader and not _is_teacher_or_admin(user, course_id):
        raise PermissionError("You do not have permission to delete this material.")

    # Remove physical file
    if material.file:
        try:
            storage = material.file.storage
            if storage.exists(material.file.name):
                storage.delete(material.file.name)
        except Exception:
            pass

    material.delete()


def _serialize(m: CourseMaterial) -> dict:
    try:
        if m.file:
            # Use PUBLIC_MEDIA_URL so the browser can reach the file via Nginx,
            # instead of the internal MinIO address (http://minio:9000/...).
            public_base = getattr(settings, "PUBLIC_MEDIA_URL", "").rstrip("/")
            if public_base:
                file_url = f"{public_base}/{m.file.name}"
            else:
                file_url = m.file.url
        else:
            file_url = ""
    except Exception:
        file_url = ""

    uploader_name = ""
    if m.uploaded_by:
        uploader_name = (
            getattr(m.uploaded_by, "username", "")
            or getattr(m.uploaded_by, "email", "")
            or str(m.uploaded_by_id)
        )

    return {
        "id": m.pk,
        "title": m.title,
        "description": m.description,
        "category": m.category,
        "original_name": m.original_name,
        "content_type": m.content_type,
        "size": m.size,
        "file_url": file_url,
        "uploaded_by": uploader_name,
        "uploaded_by_id": m.uploaded_by_id,
        "uploaded_at": m.uploaded_at.isoformat(),
    }
