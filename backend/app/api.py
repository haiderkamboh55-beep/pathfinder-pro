from fastapi import APIRouter

from app.bot import chat_with_career_bot, get_job_suggestions, generate_personalized_assessments, generate_comprehensive_career_advice, search_jobs_api, generate_personalized_followup_questions
from app.models import ChatRequest, ChatResponse, UserProfile, AssessmentGenerationRequest, AssessmentGenerationResponse, ComprehensiveAssessmentRequest, JobSearchRequest, JobSearchResponse, PersonalizedQuestionsRequest, PersonalizedQuestionsResponse

router = APIRouter()


@router.post("/recommend")
async def recommend_jobs(profile: UserProfile):
    """Return career recommendations for a given profile."""
    recommendations = get_job_suggestions(profile)
    return recommendations


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(payload: ChatRequest) -> ChatResponse:
    """
    Single-turn conversational endpoint for the chatbot assistant.

    Frontend sends profile context + a free-form question,
    Gemini + LangChain returns a supportive, actionable reply.
    """
    reply = chat_with_career_bot(payload)
    return ChatResponse(reply=reply)


@router.post("/generate-assessments")
async def generate_assessments_endpoint(request: AssessmentGenerationRequest):
    """
    Generate personalized GAD-7 and PHQ-9 questions based on user's career profile.
    
    This endpoint takes the user's career information from forms 1 & 2,
    and uses AI to generate contextually relevant mental health screening questions.
    """
    result = generate_personalized_assessments(request)
    return result


@router.post("/generate-personalized-questions", response_model=PersonalizedQuestionsResponse)
async def generate_personalized_questions_endpoint(request: PersonalizedQuestionsRequest) -> PersonalizedQuestionsResponse:
    """
    Generate personalized follow-up questions based on all 4 forms data.
    
    This endpoint receives all assessment data (basic info, interests, GAD-7, PHQ-9)
    and uses AI to generate 5-6 tailored questions that probe deeper into
    the user's career motivations, decision-making style, and growth preferences.
    """
    result = generate_personalized_followup_questions(request)
    return PersonalizedQuestionsResponse(
        questions=result.get("questions", []),
        personalization_note=result.get("personalization_note", ""),
        success=result.get("success", True)
    )


@router.post("/comprehensive-advice")
async def comprehensive_advice_endpoint(request: ComprehensiveAssessmentRequest):
    """
    Generate comprehensive career advice based on all assessment data.
    
    This endpoint receives all form data including GAD-7 and PHQ-9 responses,
    and generates a detailed, personalized career guidance report.
    """
    advice = generate_comprehensive_career_advice(request)
    return {"advice": advice, "success": True}


@router.post("/search-jobs", response_model=JobSearchResponse)
async def search_jobs_endpoint(request: JobSearchRequest) -> JobSearchResponse:
    """
    Search for real job listings based on user's profile.
    
    Uses the OpenWebNinja Job Search API to find matching jobs
    with apply links based on the user's target role and skills.
    """
    result = await search_jobs_api(request)
    return result


# ========== EMAIL CHECK ENDPOINT ==========
from pydantic import BaseModel
import os
from supabase import create_client, Client

class EmailCheckRequest(BaseModel):
    email: str

class EmailCheckResponse(BaseModel):
    exists: bool
    message: str


@router.post("/check-email", response_model=EmailCheckResponse)
async def check_email_exists(request: EmailCheckRequest) -> EmailCheckResponse:
    """
    Check if an email exists in the Supabase auth system.
    Uses sign-in attempt to verify user existence.
    """
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")
        
        if not supabase_url or not supabase_key:
            return EmailCheckResponse(exists=False, message="Server configuration error")
        
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Attempt to sign in with a dummy password
        # If we get "Invalid login credentials" - email EXISTS but password is wrong
        # If we get "User not found" or similar - email does NOT exist
        try:
            result = supabase.auth.sign_in_with_password({
                "email": request.email,
                "password": "dummy_check_password_xyz123"
            })
            # If no error, somehow login succeeded (shouldn't happen with dummy password)
            return EmailCheckResponse(exists=True, message="User found")
        except Exception as auth_error:
            error_message = str(auth_error).lower()
            
            # These messages indicate email EXISTS
            if "invalid login credentials" in error_message or \
               "invalid password" in error_message or \
               "email not confirmed" in error_message:
                return EmailCheckResponse(exists=True, message="User found")
            
            # User doesn't exist
            return EmailCheckResponse(exists=False, message="This user doesn't exist")
            
    except Exception as e:
        print(f"Email check error: {e}")
        # If error contains hints about invalid credentials, user exists
        if "invalid" in str(e).lower():
            return EmailCheckResponse(exists=True, message="User found")
        return EmailCheckResponse(exists=False, message="This user doesn't exist")


# ========== LIVE AI-POWERED DASHBOARD ENDPOINTS ==========
from app.models import MarketTrendRequest, MarketTrendsResponse, SkillCourseRequest, SkillCoursesResponse
from app.bot import generate_personalized_market_trends, generate_skill_gap_courses


@router.post("/market-trends", response_model=MarketTrendsResponse)
async def get_market_trends(request: MarketTrendRequest) -> MarketTrendsResponse:
    """
    Get AI-powered personalized market trends based on user's profile.
    
    Uses Gemini to analyze current job market trends and returns paths
    most relevant to the user's skills and target role.
    """
    result = generate_personalized_market_trends(
        skills=request.skills,
        target_role=request.target_role,
        holland_code=request.holland_code
    )
    
    return MarketTrendsResponse(
        trends=result.get("trends", []),
        insight=result.get("insight", ""),
        success=result.get("success", True)
    )


@router.post("/skill-courses", response_model=SkillCoursesResponse)
async def get_skill_courses(request: SkillCourseRequest) -> SkillCoursesResponse:
    """
    Get AI-powered personalized course recommendations for skill gaps.
    
    Uses Gemini to recommend specific courses with real links
    based on the user's skill gaps and target role.
    """
    result = generate_skill_gap_courses(
        skill_gaps=request.skill_gaps,
        target_role=request.target_role,
        current_skills=request.skills
    )
    
    return SkillCoursesResponse(
        courses=result.get("courses", []),
        learning_path_summary=result.get("learning_path_summary", ""),
        success=result.get("success", True)
    )