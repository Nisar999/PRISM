"""Neo4j graph database client."""

from neo4j import AsyncGraphDatabase

from prism.core.config import get_settings
from prism.core.logging import get_logger

logger = get_logger(__name__)


class Neo4jClient:
    """Async Neo4j driver wrapper for memory relationships."""

    def __init__(self) -> None:
        settings = get_settings()
        self._driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )

    async def close(self) -> None:
        await self._driver.close()

    async def health_check(self) -> bool:
        try:
            async with self._driver.session() as session:
                result = await session.run("RETURN 1 AS n")
                record = await result.single()
                return record is not None and record["n"] == 1
        except Exception as exc:
            logger.warning("neo4j_health_failed", error=str(exc))
            return False

    async def create_memory_node(
        self,
        memory_id: str,
        memory_type: str,
        trust: float,
        mem_score: float,
    ) -> None:
        query = """
        MERGE (m:Memory {id: $memory_id})
        SET m.type = $memory_type,
            m.trust = $trust,
            m.mem_score = $mem_score,
            m.updated_at = datetime()
        """
        async with self._driver.session() as session:
            await session.run(
                query,
                memory_id=memory_id,
                memory_type=memory_type,
                trust=trust,
                mem_score=mem_score,
            )

    async def create_relationship(
        self,
        from_id: str,
        to_id: str,
        rel_type: str,
        properties: dict | None = None,
    ) -> None:
        query = f"""
        MATCH (a:Memory {{id: $from_id}})
        MATCH (b:Memory {{id: $to_id}})
        MERGE (a)-[r:{rel_type}]->(b)
        SET r += $properties
        """
        async with self._driver.session() as session:
            await session.run(
                query,
                from_id=from_id,
                to_id=to_id,
                properties=properties or {},
            )

    async def find_related(self, memory_id: str, depth: int = 2) -> list[dict]:
        query = """
        MATCH (m:Memory {id: $memory_id})-[r*1..$depth]-(related)
        RETURN related.id AS id, related.type AS type, related.trust AS trust,
               type(r[0]) AS relationship
        LIMIT 50
        """
        async with self._driver.session() as session:
            result = await session.run(query, memory_id=memory_id, depth=depth)
            records = await result.data()
            return records

    async def find_contradictions(self, memory_id: str) -> list[dict]:
        query = """
        MATCH (m:Memory {id: $memory_id})-[:CONTRADICTS]-(c:Memory)
        RETURN c.id AS id, c.type AS type, c.trust AS trust
        """
        async with self._driver.session() as session:
            result = await session.run(query, memory_id=memory_id)
            return await result.data()
