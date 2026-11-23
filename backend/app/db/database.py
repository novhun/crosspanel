from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    import app.models.settings  # noqa: F401 - Register models with Base.metadata
    import app.models.user      # noqa: F401 - Register auth models
    from sqlalchemy import inspect, text

    def _sync_schema(connection):
        Base.metadata.create_all(connection)
        try:
            inspector = inspect(connection)
            for table_name, table in Base.metadata.tables.items():
                if inspector.has_table(table_name):
                    existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
                    for column in table.columns:
                        if column.name not in existing_cols:
                            col_type = column.type.compile(connection.dialect)
                            connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column.name} {col_type}"))
        except Exception as e:
            print(f"[Database Init Warning] Auto-migration check: {e}")

    async with engine.begin() as conn:
        await conn.run_sync(_sync_schema)
