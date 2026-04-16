"""Module summary: base defines backend functionality with clear intent."""
from __future__ import annotations

from typing import Generic, List, Optional, Type, TypeVar

from django.db import models

T = TypeVar('T', bound=models.Model)


class BaseRepository(Generic[T]):
    """Class summary: BaseRepository groups related behavior in one place."""
    
    model: Type[T] = None
    
    @classmethod
    def get_by_id(cls, pk: int) -> Optional[T]:
        """Function summary: get_by_id executes this unit of backend logic."""
        try:
            return cls.model.objects.get(pk=pk)
        except cls.model.DoesNotExist:
            return None
    
    @classmethod
    def get_all(cls, order_by: str = None) -> List[T]:
        """Function summary: get_all executes this unit of backend logic."""
        queryset = cls.model.objects.all()
        if order_by:
            queryset = queryset.order_by(order_by)
        return list(queryset)
    
    @classmethod
    def filter(cls, **kwargs) -> List[T]:
        """Function summary: filter executes this unit of backend logic."""
        return list(cls.model.objects.filter(**kwargs))
    
    @classmethod
    def exists(cls, **kwargs) -> bool:
        """Function summary: exists executes this unit of backend logic."""
        return cls.model.objects.filter(**kwargs).exists()
    
    @classmethod
    def count(cls, **kwargs) -> int:
        """Function summary: count executes this unit of backend logic."""
        return cls.model.objects.filter(**kwargs).count()
    
    @classmethod
    def create(cls, **kwargs) -> T:
        """Function summary: create executes this unit of backend logic."""
        return cls.model.objects.create(**kwargs)
    
    @classmethod
    def bulk_create(cls, objects: List[T], **kwargs) -> List[T]:
        """Function summary: bulk_create executes this unit of backend logic."""
        return cls.model.objects.bulk_create(objects, **kwargs)
    
    @classmethod
    def update_by_id(cls, pk: int, **kwargs) -> bool:
        """Function summary: update_by_id executes this unit of backend logic."""
        count = cls.model.objects.filter(pk=pk).update(**kwargs)
        return count > 0
    
    @classmethod
    def update_or_create(cls, defaults: dict = None, **kwargs) -> tuple[T, bool]:
        """Function summary: update_or_create executes this unit of backend logic."""
        return cls.model.objects.update_or_create(defaults=defaults, **kwargs)
    
    @classmethod
    def delete_by_id(cls, pk: int) -> bool:
        """Function summary: delete_by_id executes this unit of backend logic."""
        count, _ = cls.model.objects.filter(pk=pk).delete()
        return count > 0
    
    @classmethod
    def delete_by_filter(cls, **kwargs) -> int:
        """Function summary: delete_by_filter executes this unit of backend logic."""
        count, _ = cls.model.objects.filter(**kwargs).delete()
        return count


__all__ = ["BaseRepository"]
