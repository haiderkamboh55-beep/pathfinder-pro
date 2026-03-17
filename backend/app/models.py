from pydantic import BaseModel, Field
from typing import List, Optional


class UserProfile(BaseModel):
    skills: List[str] = Field(..., description="List of technical skills")
    holland_code: str = Field(..., description="The user's RIASEC primary code")
    gad_score: int = Field(..., ge=0, le=21, description="Anxiety Score (0-21)")
    phq_score: int = Field(..., ge=0, le=27, description="Depression Score (0-27)")


class JobRecommendation(BaseModel):
    job_title: str
    match_percentage: int
    reasoning: str
    skill_gaps: List[str]


class ChatRequest(BaseModel):
    """Payload for the conversational Gemini career assistant."""

    message: str = Field(..., description="User's question to the career assistant")
    skills: List[str] = Field(
        default_factory=list,
        description="Optional skills context aligned with the user's profile",
    )
    holland_code: Optional[str] = Field(
        default=None,
        description="Optional Holland (RIASEC) code to bias environment fit",
    )
    gad_score: Optional[int] = Field(
        default=None,
        ge=0,
        le=21,
        description="Optional GAD-7 score (0-21) for anxiety band awareness",
    )
    phq_score: Optional[int] = Field(
        default=None,
        ge=0,
        le=27,
        description="Optional PHQ-9 score (0-27) for mood band awareness",
    )
    # Extended assessment data for personalization
    full_name: Optional[str] = Field(default=None, description="User's full name")
    target_role: Optional[str] = Field(default=None, description="User's target career/role")
    education_level: Optional[str] = Field(default=None, description="User's education level")
    country: Optional[str] = Field(default=None, description="User's country")
    interests: List[str] = Field(default_factory=list, description="User's career interests")
    work_preferences: dict = Field(default_factory=dict, description="Work style preferences")
    gad_severity: Optional[str] = Field(default=None, description="Anxiety severity level")
    phq_severity: Optional[str] = Field(default=None, description="Mood severity level")
    career_advice: Optional[str] = Field(default=None, description="Previous career advice from assessment")
    job_page: int = Field(default=1, description="Current job pagination page (1=first 10, 2=next 10, etc.)")
    shown_job_ids: List[str] = Field(default_factory=list, description="List of job IDs already shown to prevent duplicates")
    # Conversation history for context-aware responses
    conversation_history: List[dict] = Field(
        default_factory=list, 
        description="Last 10 messages in the conversation [{role: 'user'|'assistant', content: '...'}]"
    )


class ChatResponse(BaseModel):
    """Single-turn reply from the Gemini-powered assistant."""

    reply: str


class AssessmentGenerationRequest(BaseModel):
    """Request to generate personalized assessment questions."""
    
    full_name: str = Field(..., description="User's full name")
    education_level: str = Field(..., description="Education level")
    target_role: str = Field(..., description="Target career/role")
    skills: List[str] = Field(default_factory=list, description="List of skills")
    holland_code: str = Field(..., description="3-letter Holland code")
    interests: List[str] = Field(default_factory=list, description="Career interests from form")
    work_preferences: dict = Field(default_factory=dict, description="Work style preferences")


class AssessmentQuestion(BaseModel):
    """A single assessment question."""
    
    question: str
    context: str = ""  # Why this question is relevant


class AssessmentGenerationResponse(BaseModel):
    """Response with AI-generated assessment questions."""
    
    gad_questions: List[AssessmentQuestion]
    phq_questions: List[AssessmentQuestion]
    personalization_note: str


class ComprehensiveAssessmentRequest(BaseModel):
    """Full assessment data for final career recommendations."""
    
    full_name: str
    education_level: str
    target_role: str
    skills: List[str]
    holland_code: str
    interests: List[str] = Field(default_factory=list)
    work_preferences: dict = Field(default_factory=dict)
    gad_responses: List[dict] = Field(default_factory=list)  # {question, answer, score}
    phq_responses: List[dict] = Field(default_factory=list)  # {question, answer, score}
    gad_total_score: int = 0
    phq_total_score: int = 0
    personalized_responses: List[dict] = Field(default_factory=list)  # Form 5 responses


class PersonalizedQuestionsRequest(BaseModel):
    """Request to generate personalized follow-up questions based on all 4 forms."""
    
    full_name: str = Field(..., description="User's full name")
    education_level: str = Field(..., description="Education level")
    target_role: str = Field(..., description="Target career/role")
    skills: List[str] = Field(default_factory=list, description="List of skills")
    country: str = Field(default="", description="User's country")
    holland_code: str = Field(..., description="3-letter Holland code")
    interests: List[str] = Field(default_factory=list, description="Career interests")
    work_preferences: dict = Field(default_factory=dict, description="Work style preferences")
    gad_total_score: int = Field(default=0, description="GAD-7 total score")
    phq_total_score: int = Field(default=0, description="PHQ-9 total score")
    gad_severity: str = Field(default="", description="Anxiety severity level")
    phq_severity: str = Field(default="", description="Mood severity level")


class PersonalizedQuestion(BaseModel):
    """A single personalized AI-generated question."""
    
    id: int
    question: str
    category: str = ""  # e.g., "Career Goals", "Work-Life Balance", "Growth Mindset"
    context: str = ""  # Why this question is relevant based on their profile
    options: List[str] = Field(default_factory=list)  # Optional answer choices


class PersonalizedQuestionsResponse(BaseModel):
    """Response with AI-generated personalized questions based on all forms data."""
    
    questions: List[PersonalizedQuestion] = Field(default_factory=list)
    personalization_note: str = ""  # Explains why these questions were chosen
    success: bool = True


class JobSearchRequest(BaseModel):
    """Request to search for jobs based on user profile."""
    
    target_role: str = Field(..., description="Target job role/title to search for")
    skills: List[str] = Field(default_factory=list, description="User skills for filtering")
    location: str = Field(default="", description="Optional location filter")
    remote_preference: bool = Field(default=True, description="Include remote jobs")


class JobListing(BaseModel):
    """A single job listing from the search results."""
    
    job_title: str
    company_name: str = ""
    location: str = ""
    job_type: str = ""  # full-time, part-time, contract, etc.
    description: str = ""
    apply_link: str = ""
    salary: str = ""
    posted_date: str = ""


class JobSearchResponse(BaseModel):
    """Response containing job search results."""
    
    jobs: List[JobListing] = Field(default_factory=list)
    total_found: int = 0
    search_query: str = ""
    success: bool = True
    message: str = ""


# ========== LIVE DASHBOARD MODELS ==========

class MarketTrendRequest(BaseModel):
    """Request for personalized market trends based on user profile."""
    
    skills: List[str] = Field(default_factory=list, description="User's current skills")
    target_role: str = Field(default="", description="User's target role")
    holland_code: str = Field(default="", description="User's Holland code")


class MarketTrend(BaseModel):
    """A single market trend item."""
    
    label: str  # e.g., "AI & ML", "Data Analytics"
    demand: int  # 0-100 percentage
    salary: str  # "High", "Medium-High", "Medium"
    relevance: str = ""  # Why this trend is relevant to the user
    growth: str = ""  # e.g., "+25% YoY"


class MarketTrendsResponse(BaseModel):
    """Response with personalized market trends."""
    
    trends: List[MarketTrend] = Field(default_factory=list)
    insight: str = ""  # Personalized insight for the user
    success: bool = True


class SkillCourseRequest(BaseModel):
    """Request for personalized skill course recommendations."""
    
    skill_gaps: List[str] = Field(default_factory=list, description="Skills the user needs to learn")
    target_role: str = Field(default="", description="User's target career role")
    skills: List[str] = Field(default_factory=list, description="User's current skills")


class SkillCourse(BaseModel):
    """A single course recommendation for a skill gap."""
    
    skill: str  # The skill to learn
    course_name: str  # Recommended course title
    platform: str  # Coursera, Udemy, etc.
    link: str  # Direct course/search link
    duration: str = ""  # e.g., "4 weeks", "2 hours"
    level: str = ""  # Beginner, Intermediate, Advanced
    why_learn: str = ""  # Why this skill matters for their career


class SkillCoursesResponse(BaseModel):
    """Response with personalized course recommendations."""
    
    courses: List[SkillCourse] = Field(default_factory=list)
    learning_path_summary: str = ""  # Overview of the learning journey
    success: bool = True