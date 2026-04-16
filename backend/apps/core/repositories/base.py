"""Module note: base backend module."""
from __future__ import annotations

from typing import Generic, List, Optional, Type, TypeVar

from django.db import models

T = TypeVar('T', bound=models.Model)


class BaseRepository(Generic[T]):
    """Class note: BaseRepository encapsulates related backend behavior."""
    
    model: Type[T] = None
    
    @classmethod
    def get_by_id(cls, pk: int) -> Optional[T]:
        """Function note: get_by_id handles this backend operation."""
        try:
            return cls.model.objects.get(pk=pk)
        except cls.model.DoesNotExist:
            return None
    
    @classmethod
    def get_all(cls, order_by: str = None) -> List[T]:
        """Function note: get_all handles this backend operation."""
        queryset = cls.model.objects.all()
        if order_by:
            queryset = queryset.order_by(order_by)
        return list(queryset)
    
    @classmethod
    def filter(cls, **kwargs) -> List[T]:
        """Function note: filter handles this backend operation."""
        return list(cls.model.objects.filter(**kwargs))
    
    @classmethod
    def exists(cls, **kwargs) -> bool:
        """Function note: exists handles this backend operation."""
        return cls.model.objects.filter(**kwargs).exists()
    
    @classmethod
    def count(cls, **kwargs) -> int:
        """Function note: count handles this backend operation."""
        return cls.model.objects.filter(**kwargs).count()
    
    @classmethod
    def create(cls, **kwargs) -> T:
        """Function note: create handles this backend operation."""
        return cls.model.objects.create(**kwargs)
    
    @classmethod
    def bulk_create(cls, objects: List[T], **kwargs) -> List[T]:
        """Function note: bulk_create handles this backend operation."""
        return cls.model.objects.bulk_create(objects, **kwargs)
    
    @classmethod
    def update_by_id(cls, pk: int, **kwargs) -> bool:
        """Function note: update_by_id handles this backend operation."""
        count = cls.model.objects.filter(pk=pk).update(**kwargs)
        return count > 0
    
    @classmethod
    def update_or_create(cls, defaults: dict = None, **kwargs) -> tuple[T, bool]:
        """Function note: update_or_create handles this backend operation."""
        return cls.model.objects.update_or_create(defaults=defaults, **kwargs)
    
    @classmethod
    def delete_by_id(cls, pk: int) -> bool:
        """Function note: delete_by_id handles this backend operation."""
        count, _ = cls.model.objects.filter(pk=pk).delete()
        return count > 0
    
    @classmethod
    def delete_by_filter(cls, **kwargs) -> int:
        """Function note: delete_by_filter handles this backend operation."""
        count, _ = cls.model.objects.filter(**kwargs).delete()
        return count


__all__ = ["BaseRepository"]
