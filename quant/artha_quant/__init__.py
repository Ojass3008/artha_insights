"""Artha Quant — regime-aware, regret-minimizing meta-allocator.

Public surface kept small on purpose. Import the pieces you need:

    from artha_quant import MetaAllocator, Config
"""

from .config import Config
from .meta_allocator import MetaAllocator, MetaDecision

__all__ = ["Config", "MetaAllocator", "MetaDecision"]

__version__ = "0.1.0"
