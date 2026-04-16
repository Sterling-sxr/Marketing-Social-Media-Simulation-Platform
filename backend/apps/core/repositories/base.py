"""
Base Repository Pattern

Provide common CRUD helpers so subclasses can extend them with custom queries.
"""
from __future__ import annotations

from typing import Generic, List, Optional, Type, TypeVar

from django.db import models

T = TypeVar('T', bound=models.Model)


class BaseRepository(Generic[T]):
    """
    Base class for repository helpers.

    Responsibilities:
    1. Provide shared CRUD utilities.
    2. Allow subclasses to extend for complex queries.
    3. Encapsulate database access logic.

    Example:
        class UserRepository(BaseRepository[User]):
            model = User

            @classmethod
            def find_by_email(cls, email: str):
                return cls.model.objects.filter(email=email).first()
    """
    
    model: Type[T] = None
    
    @classmethod
    def get_by_id(cls, pk: int) -> Optional[T]:
        """Retrieve a single record by primary key."""
        try:
            return cls.model.objects.get(pk=pk)
        except cls.model.DoesNotExist:
            return None
    
    @classmethod
    def get_all(cls, order_by: str = None) -> List[T]:
        """Return all records (with optional ordering)."""
        queryset = cls.model.objects.all()
        if order_by:
            queryset = queryset.order_by(order_by)
        return list(queryset)
    
    @classmethod
    def filter(cls, **kwargs) -> List[T]:
        """Filter records by keyword arguments."""
        return list(cls.model.objects.filter(**kwargs))
    
    @classmethod
    def exists(cls, **kwargs) -> bool:
        """Check whether any record matches the filter."""
        return cls.model.objects.filter(**kwargs).exists()
    
    @classmethod
    def count(cls, **kwargs) -> int:
        """Count records that satisfy the filter."""
        return cls.model.objects.filter(**kwargs).count()
    
    @classmethod
    def create(cls, **kwargs) -> T:
        """Create a new record."""
        return cls.model.objects.create(**kwargs)
    
    @classmethod
    def bulk_create(cls, objects: List[T], **kwargs) -> List[T]:
        """Bulk-create multiple records."""
        return cls.model.objects.bulk_create(objects, **kwargs)
    
    @classmethod
    def update_by_id(cls, pk: int, **kwargs) -> bool:
        """Update a record by primary key."""
        count = cls.model.objects.filter(pk=pk).update(**kwargs)
        return count > 0
    
    @classmethod
    def update_or_create(cls, defaults: dict = None, **kwargs) -> tuple[T, bool]:
        """Update or create a record."""
        return cls.model.objects.update_or_create(defaults=defaults, **kwargs)
    
    @classmethod
    def delete_by_id(cls, pk: int) -> bool:
        """Delete a record by primary key."""
        count, _ = cls.model.objects.filter(pk=pk).delete()
        return count > 0
    
    @classmethod
    def delete_by_filter(cls, **kwargs) -> int:
        """Delete records that satisfy the filter."""
        count, _ = cls.model.objects.filter(**kwargs).delete()
        return count


__all__ = ["BaseRepository"]
