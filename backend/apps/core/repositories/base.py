"""Module summary: Collect related domain logic and document the intended design boundaries."""
from __future__ import annotations

from typing import Generic, List, Optional, Type, TypeVar

from django.db import models

T = TypeVar('T', bound=models.Model)


class BaseRepository(Generic[T]):
    """Class summary: Provide a small, consistent data-access interface shared by repositories."""
    
    model: Type[T] = None
    
    @classmethod
    def get_by_id(cls, pk: int) -> Optional[T]:
        """Execute the `get_by_id` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        try:
            return cls.model.objects.get(pk=pk)
        except cls.model.DoesNotExist:
            return None
    
    @classmethod
    def get_all(cls, order_by: str = None) -> List[T]:
        """Execute the `get_all` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        queryset = cls.model.objects.all()
        if order_by:
            queryset = queryset.order_by(order_by)
        return list(queryset)
    
    @classmethod
    def filter(cls, **kwargs) -> List[T]:
        """Execute the `filter` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        return list(cls.model.objects.filter(**kwargs))
    
    @classmethod
    def exists(cls, **kwargs) -> bool:
        """Execute the `exists` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        return cls.model.objects.filter(**kwargs).exists()
    
    @classmethod
    def count(cls, **kwargs) -> int:
        """Execute the `count` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        return cls.model.objects.filter(**kwargs).count()
    
    @classmethod
    def create(cls, **kwargs) -> T:
        """Execute the `create` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        return cls.model.objects.create(**kwargs)
    
    @classmethod
    def bulk_create(cls, objects: List[T], **kwargs) -> List[T]:
        """Execute the `bulk_create` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        return cls.model.objects.bulk_create(objects, **kwargs)
    
    @classmethod
    def update_by_id(cls, pk: int, **kwargs) -> bool:
        """Execute the `update_by_id` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        count = cls.model.objects.filter(pk=pk).update(**kwargs)
        return count > 0
    
    @classmethod
    def update_or_create(cls, defaults: dict = None, **kwargs) -> tuple[T, bool]:
        """Execute the `update_or_create` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        return cls.model.objects.update_or_create(defaults=defaults, **kwargs)
    
    @classmethod
    def delete_by_id(cls, pk: int) -> bool:
        """Execute the `delete_by_id` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        count, _ = cls.model.objects.filter(pk=pk).delete()
        return count > 0
    
    @classmethod
    def delete_by_filter(cls, **kwargs) -> int:
        """Execute the `delete_by_filter` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        count, _ = cls.model.objects.filter(**kwargs).delete()
        return count


__all__ = ["BaseRepository"]
