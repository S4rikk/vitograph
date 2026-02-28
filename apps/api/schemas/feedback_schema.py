from pydantic import BaseModel, Field
from typing import Optional

class FeedbackCreate(BaseModel):
    category: str = Field(default="general", description="Category of the feedback, e.g., 'bug' or 'suggestion'")
    message: str = Field(..., max_length=2000, description="The feedback message body")
    attachment_url: Optional[str] = Field(default=None, description="Optional URL of the attached screenshot")
