"""Module summary: this module groups related logic and clarifies design intent."""
from __future__ import annotations

from typing import Generic, List, Optional, Type, TypeVar

from django.db import models

T = TypeVar('T', bound=models.Model)


class BaseRepository(Generic[T]):
    """Class summary: BaseRepository keeps related behavior together behind one clear interface."""
    
    model: Type[T] = None
    
    @classmethod
    def get_by_id(cls, pk: int) -> Optional[T]:
        """Handle the `get_by_id` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        try:
            return cls.model.objects.get(pk=pk)
        except cls.model.DoesNotExist:
            return None
    
    @classmethod
    def get_all(cls, order_by: str = None) -> List[T]:
        """Handle the `get_all` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        queryset = cls.model.objects.all()
        if order_by:
            queryset = queryset.order_by(order_by)
        return list(queryset)
    
    @classmethod
    def filter(cls, **kwargs) -> List[T]:
        """Handle the `filter` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        return list(cls.model.objects.filter(**kwargs))
    
    @classmethod
    def exists(cls, **kwargs) -> bool:
        """Handle the `exists` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        return cls.model.objects.filter(**kwargs).exists()
    
    @classmethod
    def count(cls, **kwargs) -> int:
        """Handle the `count` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        return cls.model.objects.filter(**kwargs).count()
    
    @classmethod
    def create(cls, **kwargs) -> T:
        """Handle the `create` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        return cls.model.objects.create(**kwargs)
    
    @classmethod
    def bulk_create(cls, objects: List[T], **kwargs) -> List[T]:
        """Handle the `bulk_create` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        return cls.model.objects.bulk_create(objects, **kwargs)
    
    @classmethod
    def update_by_id(cls, pk: int, **kwargs) -> bool:
        """Handle the `update_by_id` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        count = cls.model.objects.filter(pk=pk).update(**kwargs)
        return count > 0
    
    @classmethod
    def update_or_create(cls, defaults: dict = None, **kwargs) -> tuple[T, bool]:
        """Handle the `update_or_create` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        return cls.model.objects.update_or_create(defaults=defaults, **kwargs)
    
    @classmethod
    def delete_by_id(cls, pk: int) -> bool:
        """Handle the `delete_by_id` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        count, _ = cls.model.objects.filter(pk=pk).delete()
        return count > 0
    
    @classmethod
    def delete_by_filter(cls, **kwargs) -> int:
        """Handle the `delete_by_filter` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        count, _ = cls.model.objects.filter(**kwargs).delete()
        return count


__all__ = ["BaseRepository"]
