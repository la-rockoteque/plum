import argparse
import sqlite3
from contextlib import closing

from sqlalchemy import create_engine

from orm_example.repository import Base, SqlAlchemyOrderRepository
from repository_example.infrastructure.demo import demonstrate
from repository_example.infrastructure.sqlite_order_repository import (
    SqliteOrderRepository,
    initialize_schema,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare raw SQL and ORM persistence")
    parser.add_argument("mode", choices=["raw", "orm", "sql"])
    mode = parser.parse_args().mode
    if mode == "raw":
        with closing(sqlite3.connect(":memory:")) as connection:
            initialize_schema(connection)
            demonstrate(SqliteOrderRepository(connection))
    else:
        engine = create_engine("sqlite://", echo=mode == "sql")
        try:
            Base.metadata.create_all(engine)
            demonstrate(SqlAlchemyOrderRepository(engine))
        finally:
            engine.dispose()


if __name__ == "__main__":
    main()
