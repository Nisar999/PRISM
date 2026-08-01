"""PRISM Skill Registry Subsystem."""

import logging
import re
from pathlib import Path
from typing import Any, Dict, List
from pydantic import BaseModel, Field
from prism.core.mind_registry import PrismSubsystem, SubsystemMetadata

logger = logging.getLogger(__name__)

class SkillMetadata(BaseModel):
    id: str
    name: str
    description: str
    version: str = "1.0.0"
    path: str

class SkillRegistry(PrismSubsystem):
    """Subsystem for importing, discovering, and listing engineering skills."""

    def __init__(self):
        super().__init__(SubsystemMetadata(
            name="skill_registry",
            version="1.0.0",
            description="Imports and indexes metadata from legacy engineering skills",
            dependencies=["configuration"]
        ))
        self._skills: Dict[str, SkillMetadata] = {}

    async def initialize(self, registry: Any) -> None:
        self.metadata.status = "initializing"
        self.metadata.lifecycle_state = "active"
        
        # Scan legacy skills
        self.scan_skills()
        
        self.metadata.status = "active"
        self.metadata.health = "healthy"
        logger.info(f"Skill Registry initialized with {len(self._skills)} skills.")

    def scan_skills(self) -> None:
        """Scan the legacy skills in .cursor/skills/ and register metadata."""
        current = Path.cwd()
        skills_path = None
        for parent in [current] + list(current.parents):
            test_path = parent / ".cursor" / "skills"
            if test_path.exists() and test_path.is_dir():
                skills_path = test_path
                break
                
        if not skills_path:
            logger.warning("No legacy skills folder found at .cursor/skills/")
            return

        for skill_dir in skills_path.iterdir():
            if skill_dir.is_dir():
                skill_md = skill_dir / "SKILL.md"
                if skill_md.exists():
                    self._parse_and_register(skill_dir.name, skill_md)

    def _parse_and_register(self, skill_id: str, file_path: Path) -> None:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read(2048)  # Read header block
            
            match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
            name = skill_id
            description = ""
            if match:
                frontmatter_text = match.group(1)
                for line in frontmatter_text.split("\n"):
                    if ":" in line:
                        k, v = line.split(":", 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k == "name":
                            name = v
                        elif k == "description":
                            description = v
            
            self._skills[skill_id] = SkillMetadata(
                id=skill_id,
                name=name,
                description=description,
                path=str(file_path.as_posix())
            )
            logger.debug(f"Assimilated skill metadata for: {skill_id}")
        except Exception as e:
            logger.error(f"Error parsing skill {skill_id}: {e}")

    def get_skills(self) -> Dict[str, Dict[str, Any]]:
        return {
            sid: skill.model_dump()
            for sid, skill in self._skills.items()
        }

skill_registry = SkillRegistry()
