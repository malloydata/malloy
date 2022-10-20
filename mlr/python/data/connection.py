import abc
from collections.abc import Sequence


class ConnectionInterface(metaclass=abc.ABCMeta):

    @classmethod
    def __subclasshook__(cls, subclass):
        return (hasattr(subclass, 'get_schema_for_tables')
                and callable(subclass.get_schema_for_tables)
                and hasattr(subclass, 'run_query')
                and callable(subclass.run_query))

    @abc.abstractmethod
    def get_schema_for_tables(self, tables: Sequence[str]):
        raise NotImplementedError

    @abc.abstractmethod
    def run_query(self, sql: str):
        raise NotImplementedError
