import json
import os
import re
from typing import List

import httpx
from langchain_google_genai import ChatGoogleGenerativeAI

from app.models import ChatRequest, JobRecommendation, UserProfile, JobSearchRequest, JobListing, JobSearchResponse

# JSearch API from RapidAPI - fetches real job listings
JSEARCH_API_KEY = os.getenv("JSEARCH_API_KEY", "7f7148bf4amshf30da1151d49697p13f75ajsn33f28c1acde9")
JSEARCH_BASE_URL = "https://jsearch.p.rapidapi.com/search"
JSEARCH_HOST = "jsearch.p.rapidapi.com"

# SearchApi.io - Google Jobs Search (primary source for accurate job data)
SEARCHAPI_KEY = os.getenv("SEARCHAPI_KEY", "3X1FJ4ZULzH5zewC4Vsm1DVy")
SEARCHAPI_BASE_URL = "https://www.searchapi.io/api/v1/search"


def _get_llm() -> ChatGoogleGenerativeAI:
    """Create a Gemini chat model."""
    # Use environment variable or fallback to hardcoded key
    api_key = os.getenv("GOOGLE_API_KEY", "AIzaSyAEeoKJWSFHczC154P3V_VjDwHH3nGy0o8")
    
    return ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",  # Gemini 2.0 Flash - fast and reliable
        google_api_key=api_key,
        temperature=0.7,
        max_output_tokens=4096,
    )


def detect_user_intent(message: str, profile_target_role: str = "", profile_country: str = "") -> dict:
    """
    Use Gemini AI to intelligently detect user intent and extract parameters.
    
    Returns:
        dict with keys:
        - intent: 'job_search', 'course_query', 'greeting', 'career_advice', 'off_topic', 'more_jobs'
        - job_query: extracted job role/title if job search
        - location: extracted location if mentioned
        - course_topic: extracted topic if course query
        - confidence: 0-100 confidence score
        - reason: brief explanation
    """
    llm = _get_llm()
    
    prompt = f"""You are an intent classifier for a career assistant chatbot. Analyze the user message and determine their intent.

USER MESSAGE: "{message}"

CONTEXT:
- User's profile target role: {profile_target_role or 'Not specified'}
- User's country from profile: {profile_country or 'Not specified'}

CLASSIFY the intent as ONE of:
1. "job_search" - User wants to find/search for jobs or job listings
2. "more_jobs" - User wants to see MORE jobs (additional, next, different jobs from previous search)
3. "course_query" - User wants to learn, find courses, certifications, or training
4. "greeting" - Simple greeting like hi, hello, hey, good morning
5. "career_advice" - User wants career tips, resume help, interview advice, career guidance
6. "off_topic" - NOT career related (recipes, weather, politics, jokes, movies, etc.)

EXTRACT these parameters (if applicable):
- job_query: The specific job role/title they're looking for (e.g., "python developer", "data analyst", "n8n automation")
- location: Any location/city/country mentioned (e.g., "Lahore", "USA", "remote")
- course_topic: Topic they want to learn (e.g., "python", "machine learning", "project management")

RULES:
1. For job_search: Extract the EXACT job role from the message. If not explicit, use profile target role.
2. For more_jobs: Detect phrases like "more jobs", "additional", "next", "share more", "different jobs"
3. For location: Extract from message first, otherwise use profile country
4. If message is just "jobs" or "find jobs", use the profile target role as job_query
5. Be strict about off_topic - only classify as off_topic if CLEARLY not career related

Respond ONLY with valid JSON (no markdown, no extra text):
{{
    "intent": "job_search|more_jobs|course_query|greeting|career_advice|off_topic",
    "job_query": "extracted job role or empty string",
    "location": "extracted location or empty string",
    "course_topic": "extracted topic or empty string",
    "confidence": 85,
    "reason": "brief explanation"
}}"""

    try:
        result = llm.invoke(prompt)
        text = getattr(result, "content", str(result))
        
        # Clean up response
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        intent_data = json.loads(text)
        
        # Validate and set defaults
        valid_intents = ["job_search", "more_jobs", "course_query", "greeting", "career_advice", "off_topic"]
        if intent_data.get("intent") not in valid_intents:
            intent_data["intent"] = "career_advice"
        
        # If job search but no job_query extracted, use profile target role
        if intent_data.get("intent") in ["job_search", "more_jobs"] and not intent_data.get("job_query"):
            intent_data["job_query"] = profile_target_role
        
        # If no location extracted, use profile country
        if intent_data.get("intent") in ["job_search", "more_jobs"] and not intent_data.get("location"):
            intent_data["location"] = profile_country
        
        print(f"[INTENT DETECTION] Detected: {intent_data.get('intent')} | Query: '{intent_data.get('job_query', '')}' | Location: '{intent_data.get('location', '')}' | Confidence: {intent_data.get('confidence', 0)}%")
        
        return intent_data
        
    except Exception as e:
        print(f"[INTENT DETECTION] Error: {e} - Falling back to keyword detection")
        # Fallback to basic keyword detection
        message_lower = message.lower()
        
        # Basic fallback intent detection
        greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"]
        job_terms = ["job", "jobs", "position", "role", "work", "hiring", "openings", "career"]
        more_terms = ["more job", "more jobs", "additional", "next", "share more", "different jobs"]
        course_terms = ["course", "learn", "training", "certification", "tutorial", "study"]
        
        intent = "career_advice"
        if any(term in message_lower for term in more_terms):
            intent = "more_jobs"
        elif any(term in message_lower for term in greetings) and len(message_lower) < 20:
            intent = "greeting"
        elif any(term in message_lower for term in job_terms):
            intent = "job_search"
        elif any(term in message_lower for term in course_terms):
            intent = "course_query"
        
        return {
            "intent": intent,
            "job_query": profile_target_role,
            "location": profile_country,
            "course_topic": "",
            "confidence": 50,
            "reason": "Fallback keyword detection used"
        }


def get_job_suggestions(profile: UserProfile) -> List[JobRecommendation]:
    """Return structured job recommendations for a given user profile.

    We instruct Gemini to respond with a pure JSON array and then validate it
    into a list of JobRecommendation instances.
    """
    llm = _get_llm()

    prompt = f"""
    You are an AI career navigator.

    Analyze this profile:
    - Skills: {profile.skills}
    - Holland Code (RIASEC): {profile.holland_code}
    - Mental Health: GAD-7={profile.gad_score}, PHQ-9={profile.phq_score}

    Suggest 3 concrete tech careers.

    Respond ONLY with a JSON array (no extra text) where each element is:
    {{
      "job_title": string,
      "match_percentage": integer between 0 and 100,
      "reasoning": string,
      "skill_gaps": string[]
    }}

    If GAD-7 or PHQ-9 are greater than 10, prioritize roles that are
    lower in interpersonal conflict and provide predictable workloads.
    """

    result = llm.invoke(prompt)
    text = getattr(result, "content", str(result))

    # Try to parse Gemini's response as JSON, with a couple of fallbacks.
    def _parse_json(raw: str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            cleaned = raw.strip().strip("`")
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].lstrip()
            return json.loads(cleaned)

    try:
        payload = _parse_json(text)
    except Exception:
        # Fallback: return a single, generic recommendation so the UI still works.
        return [
            JobRecommendation(
                job_title="Software Developer",
                match_percentage=70,
                reasoning=(
                    "Fallback recommendation because the AI response was not valid JSON. "
                    "Check the Gemini API configuration for more reliable outputs."
                ),
                skill_gaps=[],
            )
        ]

    recommendations: List[JobRecommendation] = []
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                try:
                    recommendations.append(JobRecommendation(**item))
                except Exception:
                    continue

    if not recommendations:
        # Ensure we always return at least one element for the frontend.
        return [
            JobRecommendation(
                job_title="Software Developer",
                match_percentage=70,
                reasoning=(
                    "Fallback recommendation because the AI response could not be fully parsed. "
                    "Check the Gemini API configuration."
                ),
                skill_gaps=[],
            )
        ]

    return recommendations


def fetch_jobs_sync(query: str, location: str = "", date_posted: str = "week", max_jobs: int = 10, page: int = 1) -> list:
    """Fetch real jobs from JSearch API on RapidAPI.
    
    Args:
        query: Job search query
        location: Location filter
        date_posted: 'week' (7 days - default) or 'month' (30 days)
        max_jobs: Maximum number of jobs to return (0 = no limit)
        page: Page number for pagination (1 = first 10, 2 = next 10, etc.)
    """
    print(f"[JSEARCH API] Fetching jobs for: '{query}' in '{location}' (date: {date_posted}, max: {max_jobs}, page: {page})")
    
    try:
        import httpx
        
        # Use the JSearch API key from environment
        api_key = os.getenv("JSEARCH_API_KEY", JSEARCH_API_KEY)
        
        headers = {
            "X-RapidAPI-Key": api_key,
            "X-RapidAPI-Host": JSEARCH_HOST
        }
        
        # Build query with location if provided
        search_query = query
        if location and location.lower() not in query.lower():
            search_query = f"{query} in {location}"
        
        # Use "week" for 7 days (default), "month" for 30 days (more jobs)
        num_pages = "1" if date_posted == "week" else "3"
        
        params = {
            "query": search_query,
            "page": str(page),  # Use page parameter for pagination
            "num_pages": num_pages,
            "date_posted": date_posted  # 'week' = 7 days, 'month' = 30 days
        }
        
        print(f"[JSEARCH API] Making request with query: {search_query}")
        
        # Make synchronous request using httpx
        with httpx.Client(timeout=20.0) as client:
            response = client.get(JSEARCH_BASE_URL, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
        
        jobs = []
        job_results = data.get("data", [])
        
        print(f"[JSEARCH API] Got {len(job_results)} results from API")
        
        # Process ALL jobs from API - no limit
        for job in job_results:
            # Only include jobs with valid apply links to ensure accuracy
            apply_link = job.get("job_apply_link", "")
            if not apply_link:
                apply_link = job.get("job_google_link", "")
            
            # Skip jobs without any apply link
            if not apply_link:
                continue
            
            # Extract salary info
            salary = "Not specified"
            if job.get("job_min_salary") and job.get("job_max_salary"):
                currency = job.get("job_salary_currency", "USD")
                period = job.get("job_salary_period", "YEAR")
                min_sal = job.get("job_min_salary")
                max_sal = job.get("job_max_salary")
                
                # Format salary with proper currency
                currency_symbols = {"USD": "$", "PKR": "Rs.", "GBP": "£", "EUR": "€", "INR": "₹"}
                symbol = currency_symbols.get(currency, currency + " ")
                
                if period == "YEAR":
                    salary = f"{symbol}{min_sal:,.0f} - {symbol}{max_sal:,.0f} per year"
                elif period == "MONTH":
                    salary = f"{symbol}{min_sal:,.0f} - {symbol}{max_sal:,.0f} per month"
                else:
                    salary = f"{symbol}{min_sal:,.0f} - {symbol}{max_sal:,.0f}"
            elif job.get("job_min_salary"):
                currency = job.get("job_salary_currency", "USD")
                currency_symbols = {"USD": "$", "PKR": "Rs.", "GBP": "£", "EUR": "€", "INR": "₹"}
                symbol = currency_symbols.get(currency, currency + " ")
                salary = f"{symbol}{job.get('job_min_salary'):,.0f}+"
            
            # Get accurate company name from API
            company_name = job.get("employer_name", "")
            if not company_name:
                continue  # Skip jobs without company name
            
            # Get location
            city = job.get('job_city', '')
            state = job.get('job_state', '')
            country = job.get('job_country', '')
            location_parts = [p for p in [city, state, country] if p]
            job_location = ", ".join(location_parts) if location_parts else "Location not specified"
            
            jobs.append({
                "job_title": job.get("job_title", "Unknown Position"),
                "company_name": company_name,
                "location": job_location,
                "salary": salary,
                "apply_link": apply_link,
                "job_type": job.get("job_employment_type", "Full-time"),
                "posted_date": job.get("job_posted_at_datetime_utc", "")[:10] if job.get("job_posted_at_datetime_utc") else "",
                "job_description": job.get("job_description", "")[:400] + "..." if job.get("job_description") else "",
                "employer_logo": job.get("employer_logo", ""),
                "employer_website": job.get("employer_website", ""),
                "is_remote": job.get("job_is_remote", False),
                "source": "JSearch"
            })
        
        # Apply max_jobs limit if specified
        if max_jobs > 0 and len(jobs) > max_jobs:
            jobs = jobs[:max_jobs]
        
        print(f"[JSEARCH API] Processed {len(jobs)} valid jobs with apply links")
        return jobs
        
    except httpx.HTTPStatusError as e:
        print(f"[JSEARCH API] HTTP Error: {e.response.status_code} - {e.response.text[:200]}")
        return []
    except Exception as e:
        print(f"[JSEARCH API] Error: {e}")
        return []


def fetch_jobs_from_searchapi(query: str, location: str = "", max_jobs: int = 10) -> list:
    """Fetch jobs from SearchApi.io (Google Jobs Search) - primary source for accurate job data.
    
    Args:
        query: Job search query
        location: Location filter
        max_jobs: Maximum number of jobs to return (0 = no limit)
    """
    print(f"[SEARCHAPI] Fetching jobs for: '{query}' in '{location}' (max: {max_jobs})")
    
    try:
        import httpx
        
        # Build the search query
        search_query = query
        if location and location.lower() not in query.lower():
            search_query = f"{query} in {location}"
        
        params = {
            "engine": "google_jobs",
            "q": search_query,
            "api_key": SEARCHAPI_KEY,
        }
        
        # Add location if provided
        if location:
            params["location"] = location
        
        print(f"[SEARCHAPI] Making request with query: {search_query}")
        
        with httpx.Client(timeout=25.0) as client:
            response = client.get(SEARCHAPI_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
        
        jobs = []
        # SearchApi.io returns jobs in "jobs" array
        job_results = data.get("jobs", [])
        
        print(f"[SEARCHAPI] Got {len(job_results)} results from API")
        
        for job in job_results:
            # Get the job title
            job_title = job.get("title", "Unknown Position")
            
            # Get company name - skip if missing
            company_name = job.get("company_name", "")
            if not company_name:
                continue
            
            # Get location
            job_location = job.get("location", "")
            if not job_location:
                job_location = location or "Remote"
            
            # Extract salary from detected extensions or salary field
            salary = "Not specified"
            extensions = job.get("detected_extensions", {})
            if extensions.get("salary"):
                salary = extensions.get("salary")
            elif job.get("salary"):
                salary = job.get("salary")
            
            # Get job type from extensions
            job_type = "Full-time"
            if extensions.get("schedule_type"):
                job_type = extensions.get("schedule_type")
            elif job.get("schedule_type"):
                job_type = job.get("schedule_type")
            
            # Get posted date
            posted_date = extensions.get("posted_at", "") or job.get("posted_at", "")
            
            # Get apply link - SearchApi.io provides apply_options array
            apply_link = ""
            apply_options = job.get("apply_options", [])
            if apply_options and len(apply_options) > 0:
                apply_link = apply_options[0].get("link", "")
            
            # Fallback to share link if no apply link
            if not apply_link:
                apply_link = job.get("share_link", "") or job.get("link", "")
                if not apply_link:
                    # Create a Google Jobs link
                    apply_link = f"https://www.google.com/search?q={query.replace(' ', '+')}&ibp=htl;jobs"
            
            # Get description
            description = job.get("description", "")[:400] + "..." if job.get("description") else ""
            
            # Get company logo (thumbnail)
            company_logo = job.get("thumbnail", "") or job.get("company_logo", "")
            
            jobs.append({
                "job_title": job_title,
                "company_name": company_name,
                "location": job_location,
                "salary": salary,
                "apply_link": apply_link,
                "job_type": job_type,
                "posted_date": posted_date,
                "job_description": description,
                "employer_logo": company_logo,
                "source": "SearchAPI"
            })
        
        # Apply max_jobs limit if specified
        if max_jobs > 0 and len(jobs) > max_jobs:
            jobs = jobs[:max_jobs]
        
        print(f"[SEARCHAPI] Processed {len(jobs)} valid jobs")
        return jobs
        
    except httpx.HTTPStatusError as e:
        print(f"[SEARCHAPI] HTTP Error: {e.response.status_code} - {e.response.text[:200] if e.response.text else 'No response body'}")
        return []
    except Exception as e:
        print(f"[SEARCHAPI] Error: {e}")
        return []


def fetch_jobs_combined(query: str, location: str = "", page: int = 1) -> list:
    """Fetch jobs from both SearchApi.io and JSearch, combine and deduplicate results.
    Only returns REAL jobs from APIs - no AI-generated fake listings.
    Always limits to 10 jobs maximum.
    
    Args:
        query: Job search query
        location: Location filter
        page: Page number for pagination (1 = first 10, 2 = next 10, etc.)
    """
    # Fixed parameters: max 10 jobs per page
    date_posted = "week"  # 7 days for JSearch
    max_jobs = 10  # Always limit to 10 jobs
    
    print(f"[COMBINED SEARCH] Fetching page {page} (jobs {(page-1)*10 + 1}-{page*10}): '{query}' in '{location}'")
    
    all_jobs = []
    seen_titles = set()  # For deduplication
    
    # Primary: Fetch from SearchApi.io (Google Jobs) - more accurate data
    print(f"[COMBINED SEARCH] 📍 Calling SearchApi.io with query: '{query}'...")
    searchapi_jobs = fetch_jobs_from_searchapi(query, location, max_jobs=0)  # No per-API limit, apply at end
    print(f"[COMBINED SEARCH] SearchApi.io returned {len(searchapi_jobs)} jobs")
    
    for job in searchapi_jobs:
        title_company = f"{job.get('job_title', '').lower()}_{job.get('company_name', '').lower()}"
        if title_company not in seen_titles:
            seen_titles.add(title_company)
            all_jobs.append(job)
    
    # Secondary: Fetch from JSearch API with pagination (always call for more results)
    print(f"[COMBINED SEARCH] 📍 Calling JSearch with query: '{query}'...")
    jsearch_jobs = fetch_jobs_sync(query, location, date_posted=date_posted, max_jobs=0, page=page)
    print(f"[COMBINED SEARCH] JSearch returned {len(jsearch_jobs)} jobs")
    
    for job in jsearch_jobs:
        # Only add if has valid apply link
        if not job.get("apply_link"):
            continue
        title_company = f"{job.get('job_title', '').lower()}_{job.get('company_name', '').lower()}"
        if title_company not in seen_titles:
            seen_titles.add(title_company)
            all_jobs.append(job)
    
    # Apply max_jobs limit to combined results
    if max_jobs > 0 and len(all_jobs) > max_jobs:
        print(f"[COMBINED SEARCH] Limiting from {len(all_jobs)} to {max_jobs} jobs")
        all_jobs = all_jobs[:max_jobs]
    
    print(f"[COMBINED SEARCH] ✅ Total unique jobs: {len(all_jobs)} (SearchAPI: {len(searchapi_jobs)}, JSearch: {len(jsearch_jobs)})")
    
    # Return only REAL jobs - no AI fallback to avoid fake company names
    return all_jobs


def _fallback_job_search(query: str, location: str = "") -> list:
    """Generate realistic job listings using AI with real job portal search links."""
    print(f"[FALLBACK JOB SEARCH] Generating jobs for: {query} in {location}")
    
    try:
        llm = _get_llm()
        
        # Determine if it's a Pakistani location for local job portals
        pakistan_locations = ["pakistan", "lahore", "karachi", "islamabad", "rawalpindi", "faisalabad"]
        is_pakistan = any(loc in location.lower() for loc in pakistan_locations) if location else False
        
        prompt = f"""
        Generate 5 realistic job listings for: {query}
        Location: {location or "Remote/Worldwide"}
        
        Respond ONLY with a valid JSON array. Each job must have:
        - job_title: Specific title (e.g., "Senior n8n Automation Engineer")
        - company_name: A REAL company name that hires for this role
        - location: Specific city/country
        - salary: Realistic salary range in local currency
        - job_type: Full-time, Part-time, Contract, or Remote
        
        Use real companies known for hiring {query} roles.
        Make salaries realistic for {location or "the region"}.
        
        Example format:
        [
            {{"job_title": "...", "company_name": "...", "location": "...", "salary": "...", "job_type": "..."}}
        ]
        """
        
        result = llm.invoke(prompt)
        text = getattr(result, "content", str(result))
        
        # Clean markdown code blocks
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        job_data = json.loads(text)
        jobs = []
        
        for job in job_data[:5]:
            job_title = job.get("job_title", query)
            company = job.get("company_name", "Company")
            job_location = job.get("location", location or "Remote")
            
            # Create proper search URLs
            title_encoded = job_title.replace(" ", "%20")
            loc_encoded = job_location.replace(" ", "%20").replace(",", "")
            
            # Choose appropriate job portal based on location
            if is_pakistan:
                # Use Rozee.pk for Pakistani jobs
                apply_link = f"https://www.rozee.pk/job/jsearch/q/{title_encoded}"
            else:
                # Use LinkedIn for international
                apply_link = f"https://www.linkedin.com/jobs/search/?keywords={title_encoded}&location={loc_encoded}"
            
            jobs.append({
                "job_title": job_title,
                "company_name": company,
                "location": job_location,
                "salary": job.get("salary", "Competitive"),
                "apply_link": apply_link,
                "job_type": job.get("job_type", "Full-time"),
                "posted_date": "",
                "job_description": f"Search for {job_title} positions at {company} and similar companies."
            })
        
        print(f"[FALLBACK JOB SEARCH] Generated {len(jobs)} AI-powered job listings")
        return jobs
        
    except Exception as e:
        print(f"[FALLBACK JOB SEARCH] AI generation failed: {e}")
        # Ultimate fallback - direct portal links
        role_encoded = query.replace(" ", "%20")
        loc_encoded = location.replace(" ", "%20") if location else ""
        
        is_pakistan = any(loc in location.lower() for loc in ["pakistan", "lahore", "karachi", "islamabad"]) if location else False
        
        if is_pakistan:
            return [
                {
                    "job_title": f"{query} - Rozee.pk",
                    "company_name": "Rozee.pk (Pakistan's #1 Job Site)",
                    "location": location or "Pakistan",
                    "salary": "View listings",
                    "apply_link": f"https://www.rozee.pk/job/jsearch/q/{role_encoded}",
                    "job_type": "Various",
                    "posted_date": "",
                    "job_description": f"Search {query} jobs on Pakistan's largest job portal."
                },
                {
                    "job_title": f"{query} - Indeed Pakistan",
                    "company_name": "Indeed Pakistan",
                    "location": location or "Pakistan",
                    "salary": "View listings",
                    "apply_link": f"https://pk.indeed.com/jobs?q={role_encoded}&l={loc_encoded}",
                    "job_type": "Various",
                    "posted_date": "",
                    "job_description": f"Search {query} jobs on Indeed Pakistan."
                },
                {
                    "job_title": f"{query} - LinkedIn",
                    "company_name": "LinkedIn Jobs",
                    "location": location or "Pakistan",
                    "salary": "View listings",
                    "apply_link": f"https://www.linkedin.com/jobs/search/?keywords={role_encoded}&location=Pakistan",
                    "job_type": "Various",
                    "posted_date": "",
                    "job_description": f"Search {query} jobs on LinkedIn."
                },
                {
                    "job_title": f"{query} - Mustakbil",
                    "company_name": "Mustakbil.com",
                    "location": location or "Pakistan",
                    "salary": "View listings",
                    "apply_link": f"https://www.mustakbil.com/jobs?q={role_encoded}",
                    "job_type": "Various",
                    "posted_date": "",
                    "job_description": f"Search {query} jobs on Mustakbil."
                }
            ]
        else:
            return [
                {
                    "job_title": f"{query} - LinkedIn",
                    "company_name": "LinkedIn Jobs",
                    "location": location or "Remote",
                    "salary": "View listings",
                    "apply_link": f"https://www.linkedin.com/jobs/search/?keywords={role_encoded}&location={loc_encoded}",
                    "job_type": "Various",
                    "posted_date": "",
                    "job_description": f"Search {query} jobs on LinkedIn."
                },
                {
                    "job_title": f"{query} - Indeed",
                    "company_name": "Indeed",
                    "location": location or "Remote",
                    "salary": "View listings",
                    "apply_link": f"https://www.indeed.com/jobs?q={role_encoded}&l={loc_encoded}",
                    "job_type": "Various",
                    "posted_date": "",
                    "job_description": f"Search {query} jobs on Indeed."
                },
                {
                    "job_title": f"{query} - Glassdoor",
                    "company_name": "Glassdoor",
                    "location": location or "Remote",
                    "salary": "View listings",
                    "apply_link": f"https://www.glassdoor.com/Job/jobs.htm?sc.keyword={role_encoded}",
                    "job_type": "Various",
                    "posted_date": "",
                    "job_description": f"Search {query} jobs on Glassdoor."
                }
            ]


async def search_jobs_api(request: JobSearchRequest) -> JobSearchResponse:
    """
    Search for real job listings using BOTH JSearch and SearchAPI.
    This is the main API endpoint function for /search-jobs.
    Returns ONLY real jobs from APIs - NO AI-generated fake listings.
    """
    print(f"[SEARCH JOBS API] Request: role={request.target_role}, location={request.location}")
    
    try:
        # Build the search query
        search_query = request.target_role or "Software Developer"
        location = request.location or ""
        
        if request.skills and len(request.skills) > 0:
            # Add top skills to the query for better matching
            skills_str = " ".join(request.skills[:2])
            search_query = f"{search_query} {skills_str}"
        
        # Add remote preference if specified
        if request.remote_preference:
            search_query = f"{search_query} remote"
        
        print(f"[SEARCH JOBS API] Query: '{search_query}', Location: '{location}'")
        
        # Use the combined fetch function that searches BOTH APIs
        # This returns REAL jobs only - no AI-generated fake listings
        jobs_data = fetch_jobs_combined(search_query, location, page=1)
        
        print(f"[SEARCH JOBS API] Found {len(jobs_data)} REAL jobs from combined APIs")
        
        # Convert to JobListing format
        jobs = []
        for job in jobs_data[:10]:  # Limit to 10 jobs
            # Extract salary
            salary = job.get("salary") or job.get("salary_range") or "Not specified"
            
            # Format posted date
            posted_date = job.get("posted_date") or job.get("job_posted_at", "Recently")
            if isinstance(posted_date, str) and len(posted_date) > 10:
                posted_date = posted_date[:10]
            
            jobs.append(JobListing(
                job_title=job.get("job_title", "Unknown"),
                company_name=job.get("company_name", "Unknown"),
                location=job.get("location", "Remote"),
                job_type=job.get("job_type") or job.get("employment_type", "Full Time"),
                description=job.get("job_description", job.get("description", ""))[:300] if job.get("job_description") or job.get("description") else "",
                apply_link=job.get("apply_link") or job.get("job_apply_link", ""),
                salary=salary,
                posted_date=posted_date
            ))
        
        if jobs:
            return JobSearchResponse(
                jobs=jobs,
                success=True,
                message=f"Found {len(jobs)} real jobs matching your search"
            )
        else:
            # No jobs found - return empty list with helpful message
            # DO NOT generate fake AI jobs
            return JobSearchResponse(
                jobs=[],
                success=True,
                message=f"No jobs found for '{request.target_role}' in '{location}'. Try broadening your search."
            )
        
    except Exception as e:
        print(f"[SEARCH JOBS API] Error: {e}")
        return JobSearchResponse(
            jobs=[], 
            success=False, 
            message=f"Error searching jobs: {str(e)}"
        )


def filter_jobs_by_location(jobs: list, location: str) -> list:
    """Filter jobs to only include those matching the specified location."""
    if not location:
        return jobs
    
    location_lower = location.lower()
    filtered = []
    
    for job in jobs:
        job_location = job.get("location", "").lower()
        # Check if the location matches
        if location_lower in job_location or job_location in location_lower:
            filtered.append(job)
    
    return filtered


def chat_with_career_bot(request: ChatRequest) -> str:
    """Single-turn conversational assistant with AI-powered intent detection and job search integration.
    
    Uses Gemini AI to:
    1. Detect user intent (job search, course query, greeting, career advice, off-topic)
    2. Extract job roles and locations from natural language
    3. Provide intelligent responses based on context
    """
    llm = _get_llm()
    
    # === AI-POWERED INTENT DETECTION ===
    # Use Gemini to intelligently understand what the user wants
    intent_data = detect_user_intent(
        message=request.message,
        profile_target_role=request.target_role or "",
        profile_country=request.country or ""
    )
    
    detected_intent = intent_data.get("intent", "career_advice")
    job_query = intent_data.get("job_query", "")
    location = intent_data.get("location", "")
    course_topic = intent_data.get("course_topic", "")
    
    print(f"[CHAT BOT] Intent: {detected_intent} | Job Query: '{job_query}' | Location: '{location}'")
    
    # === HANDLE OFF-TOPIC REQUESTS ===
    if detected_intent == "off_topic":
        return "I'm sorry, but I'm PathFinder Pro - your AI career assistant. I can only help with career guidance, job searches, skill development, courses, and professional growth. Please ask me something career-related! 🎯"
    
    # === HANDLE JOB SEARCHES ===
    job_listings = ""
    is_job_search = detected_intent in ["job_search", "more_jobs"]
    
    if is_job_search:
        # === ASSESSMENT-BOUND JOB SEARCH RESTRICTION ===
        # If user has a target_role from their Career Discovery assessment,
        # the bot is STRICTLY bound to that role. It will NOT search for other job types.
        
        if request.target_role and request.target_role.strip():
            profile_target_role = request.target_role.strip().lower()
            ai_extracted_job = job_query.strip().lower() if job_query else ""
            
            # Check if the AI-extracted job is different from the profile target role
            # Only block if user explicitly asked for a DIFFERENT type of job
            if ai_extracted_job and ai_extracted_job != profile_target_role:
                # Check if the extracted job query is truly different (not just a variation)
                target_role_keywords = set(profile_target_role.split())
                extracted_keywords = set(ai_extracted_job.split())
                
                # If there's no overlap between keywords, it's a different job type
                overlap = target_role_keywords.intersection(extracted_keywords)
                
                # Also check for common automation-related terms if target is n8n/automation
                automation_terms = {"n8n", "automation", "workflow", "make", "zapier", "integromat", "rpa", "nocode", "no-code", "low-code", "api", "integration"}
                target_is_automation = bool(target_role_keywords.intersection(automation_terms))
                extracted_is_related = bool(extracted_keywords.intersection(automation_terms))
                
                if not overlap and not (target_is_automation and extracted_is_related):
                    # User is asking for a completely different job type - DECLINE
                    print(f"[ASSESSMENT BOUND] ❌ Declining off-profile request: '{ai_extracted_job}' vs profile '{request.target_role}'")
                    
                    decline_message = f"""I understand you're interested in **{job_query}** jobs, but your Career Discovery assessment is focused on **{request.target_role}**.

🎯 **Why am I bound to your assessment?**
My job recommendations are tailored specifically to your assessment profile to ensure the best career fit based on:
- Your skills and interests
- Your personality (Holland Code: {request.holland_code or 'N/A'})
- Your wellbeing scores

📋 **Your options:**
1. I can find **{request.target_role}** jobs for you right now
2. Complete a **new Career Discovery assessment** to update your career goals to {job_query}

Would you like me to search for **{request.target_role}** opportunities instead? 🚀"""
                    return decline_message
            
            # ALWAYS use the profile's target role for job search (not the AI-extracted one)
            job_query = request.target_role.strip()
            print(f"[JOB SEARCH] 🔒 BOUND MODE: Using profile target role: '{job_query}'")
        
        # Use AI-extracted location, or fall back to profile country
        if not location and request.country:
            location = request.country
            print(f"[JOB SEARCH] Using profile country: {location}")
        
        if not job_query:
            job_query = "software developer"  # Final fallback
            print(f"[JOB SEARCH] No query found, using fallback: {job_query}")
        
        # === DETECT "MORE JOBS" REQUESTS FOR PAGINATION ===
        want_more = detected_intent == "more_jobs"
        
        # Get previously shown job IDs from request
        shown_job_ids = set(request.shown_job_ids) if request.shown_job_ids else set()
        
        print(f"[JOB SEARCH] want_more={want_more}, shown_job_ids count={len(shown_job_ids)}")
        
        # Determine page number
        if want_more:
            page = request.job_page if request.job_page and request.job_page > 1 else 2
            print(f"[JOB SEARCH] User requested MORE jobs - fetching page {page}")
        else:
            page = 1
            shown_job_ids = set()
            print(f"[JOB SEARCH] Standard search - fetching page 1")
        
        # === FETCH JOBS FROM BOTH APIs ===
        # Uses both JSearch and SearchAPI for comprehensive results
        print(f"[JOB SEARCH] 🔍 Fetching jobs: query='{job_query}', location='{location}', page={page}")
        jobs = fetch_jobs_combined(job_query, location, page=page)
        
        print(f"[JOB SEARCH] Found {len(jobs)} total jobs from combined APIs (JSearch + SearchAPI)")
        
        # === RELEVANCE FILTER ===
        if jobs and job_query:
            search_keywords = job_query.lower().split()
            
            # Add related keywords for common roles
            if "n8n" in job_query.lower():
                search_keywords.extend(["automation", "workflow", "make", "zapier", "integration", "nocode"])
            if "automation" in job_query.lower():
                search_keywords.extend(["workflow", "rpa", "process", "api", "automate"])
            if "developer" in job_query.lower() or "engineer" in job_query.lower():
                search_keywords.extend(["developer", "engineer", "software", "tech", "programming"])
            
            search_keywords = list(set(search_keywords))
            
            relevant_jobs = []
            for job in jobs:
                job_title = job.get('job_title', '').lower()
                job_desc = job.get('job_description', '').lower()
                combined_text = f"{job_title} {job_desc}"
                
                matching_keywords = [kw for kw in search_keywords if len(kw) > 2 and kw in combined_text]
                
                if len(matching_keywords) >= 1:
                    relevant_jobs.append(job)
                    print(f"[JOB SEARCH] ✓ Relevant: '{job_title[:50]}' - matched: {matching_keywords[:3]}")
            
            if relevant_jobs:
                print(f"[JOB SEARCH] Filtered to {len(relevant_jobs)} relevant jobs (from {len(jobs)})")
                jobs = relevant_jobs
            else:
                print(f"[JOB SEARCH] No relevant jobs found after filtering")
                jobs = []
        
        # Filter jobs by location if specified
        if location and jobs:
            filtered_jobs = filter_jobs_by_location(jobs, location)
            print(f"[JOB SEARCH] {len(filtered_jobs)} jobs match location '{location}'")
            jobs = filtered_jobs if filtered_jobs else jobs
        
        # Filter out already-shown jobs
        if shown_job_ids and jobs:
            original_count = len(jobs)
            jobs = [
                job for job in jobs 
                if f"{job.get('job_title', '').lower()}_{job.get('company_name', '').lower()}" not in shown_job_ids
            ]
            filtered_count = original_count - len(jobs)
            if filtered_count > 0:
                print(f"[JOB SEARCH] Filtered out {filtered_count} already-shown jobs, {len(jobs)} new jobs remaining")
        
        # Build job listings response
        if jobs:
            new_job_ids = [
                f"{job.get('job_title', '').lower()}_{job.get('company_name', '').lower()}"
                for job in jobs
            ]
            
            jobs_with_page = {
                "jobs": jobs, 
                "current_page": page, 
                "next_page": page + 1,
                "new_job_ids": new_job_ids,
                "has_more": len(jobs) >= 5
            }
            job_listings = "\n\n---JOBS_DATA---\n" + json.dumps(jobs_with_page) + "\n---END_JOBS_DATA---"
        elif want_more:
            job_listings = """

📌 **No more jobs available!**

You've seen all the latest job listings for your search. Here's what you can do:

✅ **Check back later** - New jobs are posted daily!
✅ **Try a different search** - Explore related roles or industries
✅ **Expand your location** - Consider remote or nearby cities

Would you like me to help you with something else, like career advice or skill development? 🎯"""
        else:
            # No jobs found - provide helpful job portal links
            search_query_encoded = job_query.replace(" ", "%20")
            pakistan_locations = ["lahore", "karachi", "islamabad", "rawalpindi", "faisalabad", "multan", "peshawar", "quetta", "pakistan"]
            is_pakistan = any(loc in location.lower() for loc in pakistan_locations) if location else False
            
            if is_pakistan:
                job_listings = f"""

📌 **No direct job listings found for this search.** Here are some job portals for Pakistan:

🔗 **Rozee.pk** - Pakistan's #1 Job Site
   https://www.rozee.pk/job/jsearch/q/{search_query_encoded}

🔗 **Indeed Pakistan**
   https://pk.indeed.com/jobs?q={search_query_encoded}

🔗 **LinkedIn Jobs**
   https://www.linkedin.com/jobs/search/?keywords={search_query_encoded}&location=Pakistan

💡 Tip: Create profiles on these platforms and set up job alerts for your preferred roles!
"""
            else:
                job_listings = f"""

📌 **No direct job listings found.** Try these job portals:

🔗 **LinkedIn Jobs**
   https://www.linkedin.com/jobs/search/?keywords={search_query_encoded}

🔗 **Indeed**
   https://www.indeed.com/jobs?q={search_query_encoded}

🔗 **Glassdoor**
   https://www.glassdoor.com/Job/jobs.htm?sc.keyword={search_query_encoded}

💡 Tip: Try different keywords or locations for more results!
"""

    # === BUILD CONVERSATION CONTEXT ===
    conversation_context = ""
    if request.conversation_history and len(request.conversation_history) > 0:
        history_messages = request.conversation_history[-10:]
        conversation_lines = []
        for msg in history_messages:
            role = msg.get('role', 'user')
            content = msg.get('content', '')[:500]
            if '---JOBS_DATA---' in content:
                content = content.split('---JOBS_DATA---')[0].strip()
            if content:
                prefix = "👤 User" if role == "user" else "🤖 Assistant"
                conversation_lines.append(f"{prefix}: {content[:300]}...")
        
        if conversation_lines:
            conversation_context = f"""
    ╔══════════════════════════════════════════════════════════════════╗
    ║                    RECENT CONVERSATION HISTORY                    ║
    ╚══════════════════════════════════════════════════════════════════╝
    
    {chr(10).join(conversation_lines[-6:])}
"""

    # === BUILD USER PROFILE CONTEXT ===
    holland_descriptions = {
        'R': 'Realistic - practical, hands-on',
        'I': 'Investigative - analytical, research-oriented',
        'A': 'Artistic - creative, expressive',
        'S': 'Social - helping others, teamwork',
        'E': 'Enterprising - leadership, business',
        'C': 'Conventional - organized, detail-oriented'
    }
    
    holland_interpretation = ""
    if request.holland_code:
        letters = list(request.holland_code.upper()[:3])
        holland_interpretation = " | ".join([holland_descriptions.get(l, l) for l in letters])
    
    mental_health_guidance = ""
    gad = request.gad_score or 0
    phq = request.phq_score or 0
    
    if gad >= 10 or phq >= 10:
        mental_health_guidance = "⚠️ WELLBEING NOTE: Prioritize remote work, structured roles, and good work-life balance."
    elif gad >= 5 or phq >= 5:
        mental_health_guidance = "📊 Consider balanced workloads and supportive team environments."
    
    has_profile = request.full_name or request.target_role or request.holland_code
    
    user_context = f"""{conversation_context}
    ╔══════════════════════════════════════════════════════════════════╗
    ║                    USER PROFILE                                   ║
    ╚══════════════════════════════════════════════════════════════════╝
    
    👤 Name: {request.full_name or 'Not provided'}
    🎯 Target Role: {request.target_role or 'Not specified'}
    🌍 Country: {request.country or 'Not specified'}
    🛠️ Skills: {', '.join(request.skills) if request.skills else 'Not specified'}
    🧭 Holland Code: {request.holland_code or 'N/A'} → {holland_interpretation}
    💚 GAD-7: {request.gad_score or 'N/A'}/21 | PHQ-9: {request.phq_score or 'N/A'}/27
    {mental_health_guidance}
""" if has_profile else conversation_context

    # === GENERATE RESPONSE BASED ON INTENT ===
    if detected_intent == "greeting":
        if request.full_name:
            prompt = f"""{user_context}
        You are PathFinder Pro, a friendly career coach.
        The user said: "{request.message}"
        
        Greet them warmly by first name: {request.full_name.split()[0]}
        Mention you've reviewed their career goals (target: {request.target_role or 'their role'})
        Keep it brief (2-3 sentences) and warm. Ask how you can help today.
        """
        else:
            prompt = f"""
        You are PathFinder Pro, a friendly career coach.
        The user said: "{request.message}"
        
        Respond with a SHORT, friendly greeting (1-2 sentences).
        Ask how you can help with their career journey today.
        """
    
    elif detected_intent == "course_query":
        topic = course_topic or request.target_role or "professional development"
        prompt = f"""{user_context}
        You are PathFinder Pro, helping with learning resources.
        
        User wants to learn about: "{request.message}"
        Detected topic: {topic}
        
        Provide 3-4 course recommendations with:
        1. [Course Name] - [Platform]
           Link: [URL]
           Why: [1 sentence relevance to their career]
        
        Keep it focused and personalized to their target role: {request.target_role or 'career goals'}
        """
    
    elif is_job_search:
        work_env_advice = ""
        if gad >= 10 or phq >= 10:
            work_env_advice = "Given their wellbeing scores, EMPHASIZE remote work and flexible hours."
        
        prompt = f"""{user_context}
        You are PathFinder Pro, a mental health-aware career coach.
        
        User message: "{request.message}"
        AI-detected intent: Job search for "{job_query}" in "{location or 'their area'}"
        
        🎯 RESPONSE INSTRUCTIONS:
        1. Greet by name: {request.full_name.split()[0] if request.full_name else 'there'}
        2. Acknowledge their job search for {job_query}
        3. {work_env_advice or 'Provide a relevant career tip.'}
        4. Keep response to 2-3 sentences. Be warm and encouraging.
        
        NOTE: Real job listings from JSearch and SearchAPI will be added automatically. Do NOT make up jobs.
        """
    
    else:  # career_advice or other
        prompt = f"""{user_context}
        You are PathFinder Pro, a personalized AI career coach.
        
        User message: "{request.message}"
        
        Give advice PERSONALIZED to this user's profile:
        - Reference their target role ({request.target_role or 'not specified'}) if relevant
        - Consider their skills ({', '.join(request.skills[:3]) if request.skills else 'not specified'})
        - Factor in their Holland Code ({request.holland_code or 'not assessed'}) personality
        
        Respond in 3-5 sentences. Be helpful, warm, and personalized.
        Use their name ({request.full_name.split()[0] if request.full_name else 'friend'}) if it feels natural.
        """

    try:
        result = llm.invoke(prompt)
        response = getattr(result, "content", str(result))
        
        # Append job listings if found
        if job_listings:
            response += job_listings
        
        return response
    except Exception as e:
        print(f"Chat error: {e}")
        return "I'm here to help with your career questions! What would you like to know?"


def generate_personalized_assessments(request) -> dict:
    """Generate personalized GAD-7 and PHQ-9 questions based on user's career profile."""
    llm = _get_llm()
    
    prompt = f"""
    You are a career psychologist creating personalized mental health screening questions.
    
    The user is:
    - Name: {request.full_name}
    - Education: {request.education_level}
    - Target Career: {request.target_role}
    - Skills: {', '.join(request.skills) if request.skills else 'Not specified'}
    - Holland Code: {request.holland_code}
    - Career Interests: {', '.join(request.interests) if request.interests else 'General career growth'}
    - Work Preferences: {request.work_preferences}
    
    Generate PERSONALIZED mental health screening questions that are contextually relevant to their career goals.
    
    For GAD-7 (Anxiety Assessment):
    - Create 7 questions about anxiety, worrying, and nervousness
    - Tailor them to career-related anxiety (e.g., job performance, career decisions, workplace stress)
    - Make them relevant to their target role: {request.target_role}
    
    For PHQ-9 (Depression Assessment):
    - Create 9 questions about mood, energy, and motivation
    - Tailor them to career satisfaction and work-life balance
    - Consider their Holland code ({request.holland_code}) work style preferences
    
    Respond ONLY with valid JSON in this exact format:
    {{
        "gad_questions": [
            {{"question": "Over the past 2 weeks, how often have you felt nervous about [specific career aspect]?", "context": "This relates to your goal of becoming a {request.target_role}"}},
            ... (7 total questions)
        ],
        "phq_questions": [
            {{"question": "Over the past 2 weeks, how often have you had little interest in [career-related activity]?", "context": "This connects to your {request.holland_code[0] if request.holland_code else 'work'} interests"}},
            ... (9 total questions)
        ],
        "personalization_note": "These questions are tailored to your career journey toward {request.target_role}..."
    }}
    
    Make questions supportive and non-clinical. These help match careers to wellbeing needs.
    """
    
    result = llm.invoke(prompt)
    text = getattr(result, "content", str(result))
    
    # Parse JSON response
    def _parse_json(raw: str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            cleaned = raw.strip().strip("`")
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].lstrip()
            return json.loads(cleaned)
    
    try:
        return _parse_json(text)
    except Exception as e:
        # Fallback with generic but still relevant questions
        return {
            "gad_questions": [
                {"question": f"Over the past 2 weeks, how often have you felt nervous about your career progress toward becoming a {request.target_role}?", "context": "Career anxiety"},
                {"question": "How often have you worried about not having the right skills for your target role?", "context": "Skill-related anxiety"},
                {"question": "How often have you felt anxious about job market competition?", "context": "Market anxiety"},
                {"question": "How often have you had trouble relaxing when thinking about career decisions?", "context": "Decision anxiety"},
                {"question": "How often have you felt restless about your professional development pace?", "context": "Growth anxiety"},
                {"question": "How often have you become easily irritated when facing career setbacks?", "context": "Frustration"},
                {"question": "How often have you felt afraid that your career plans might not work out?", "context": "Future anxiety"},
            ],
            "phq_questions": [
                {"question": "Over the past 2 weeks, how often have you had little interest in learning new skills for your career?", "context": "Learning motivation"},
                {"question": "How often have you felt down about your current career situation?", "context": "Career satisfaction"},
                {"question": "How often have you had trouble focusing on career development tasks?", "context": "Focus and concentration"},
                {"question": "How often have you felt tired when thinking about career planning?", "context": "Energy levels"},
                {"question": "How often have you felt like your career goals are too difficult to achieve?", "context": "Self-efficacy"},
                {"question": "How often have you had trouble sleeping due to career-related thoughts?", "context": "Sleep quality"},
                {"question": "How often have you felt less motivated about your professional growth?", "context": "Career motivation"},
                {"question": "How often have you felt stuck in your career journey?", "context": "Career momentum"},
                {"question": "How often have you questioned whether your target role is right for you?", "context": "Career alignment"},
            ],
            "personalization_note": f"These questions are designed to understand how your mental wellbeing connects to your journey toward becoming a {request.target_role}."
        }


def generate_comprehensive_career_advice(request) -> str:
    """Generate comprehensive career advice based on all assessment data."""
    llm = _get_llm()
    
    # Interpret scores
    gad_level = "minimal" if request.gad_total_score <= 4 else "mild" if request.gad_total_score <= 9 else "moderate" if request.gad_total_score <= 14 else "significant"
    phq_level = "minimal" if request.phq_total_score <= 4 else "mild" if request.phq_total_score <= 9 else "moderate" if request.phq_total_score <= 14 else "significant"
    
    # Format responses for context
    gad_context = "\n".join([f"- Q: {r.get('question', 'N/A')[:100]}... A: {r.get('answer', 'N/A')} (Score: {r.get('score', 0)})" for r in request.gad_responses[:3]])
    phq_context = "\n".join([f"- Q: {r.get('question', 'N/A')[:100]}... A: {r.get('answer', 'N/A')} (Score: {r.get('score', 0)})" for r in request.phq_responses[:3]])
    
    prompt = f"""
    You are PathFinder Pro, an expert career advisor combining career psychology and mental health awareness.
    
    ## Complete User Assessment Data:
    
    **Personal Profile:**
    - Name: {request.full_name}
    - Education: {request.education_level}
    - Target Role: {request.target_role}
    - Skills: {', '.join(request.skills)}
    
    **Career Personality (Holland Code: {request.holland_code}):**
    - Primary: {request.holland_code[0] if len(request.holland_code) >= 1 else 'Unknown'} 
    - Secondary: {request.holland_code[1] if len(request.holland_code) >= 2 else 'Unknown'}
    - Tertiary: {request.holland_code[2] if len(request.holland_code) >= 3 else 'Unknown'}
    
    **Career Interests:** {', '.join(request.interests) if request.interests else 'General career advancement'}
    
    **Work Preferences:** {request.work_preferences}
    
    **Mental Health Assessment Results:**
    - GAD-7 Total Score: {request.gad_total_score}/21 ({gad_level} anxiety indicators)
    - PHQ-9 Total Score: {request.phq_total_score}/27 ({phq_level} mood indicators)
    
    Sample anxiety responses:
    {gad_context}
    
    Sample mood responses:
    {phq_context}
    
    ## Your Task:
    
    Provide a COMPREHENSIVE, ACTIONABLE career guidance report with these sections ONLY:
    
    1. **Career Matches (3-5 roles)**: Suggest specific job titles that align with their:
       - Skills and education
       - Holland Code personality type
       - Mental health compatibility (stress level, work environment)
    
    2. **Personalized Insights**: Explain WHY each role suits them based on their unique combination of interests and wellbeing needs
    
    3. **Recommended Courses & Learning Resources**:
       Provide 3-5 SPECIFIC courses. PRIORITIZE exact, deeply-linked course URLs for best-selling/popular courses.
       
       If you know the exact URL, use it:
       - Example: https://www.udemy.com/course/the-complete-python-bootcamp/
       - Example: https://www.coursera.org/learn/machine-learning
       
       If you do NOT know the exact URL, use a specific search link:
       - Coursera: https://www.coursera.org/search?query=EXACT_COURSE_NAME
       - Udemy: https://www.udemy.com/courses/search/?q=EXACT_COURSE_NAME
       
       Format each course recommendation as:
       - **[Skill/Topic Name]** - [Platform Name]
         [Exact Link]
         Why: [Brief reason why this course helps their career goal]
    
    4. **Development Roadmap**: 
       - Skills to develop
       - Certifications to consider
       - Timeline suggestions (3-month, 6-month, 1-year goals)
    
    5. **Work Environment Recommendations**:
       - Based on their anxiety/mood scores, suggest ideal work environments
       - Remote vs office, team size, communication style
    
    6. **Wellbeing-Career Balance Tips**:
       - How to pursue career growth while maintaining mental wellness
       - Red flags to avoid in job searches
       - Self-care strategies for their career journey
    
    7. **Immediate Next Steps**:
       - 3 concrete actions they can take this week
    
    IMPORTANT RULES:
    - DO NOT include a "Job Search Resources" section - we will show real job listings separately
    - DO NOT include LinkedIn, Indeed, or Glassdoor job search links manually
    - Format your response with clear headers and bullet points
    - Be empathetic but practical. This is career coaching, not therapy.
    - Emphasize that mental health scores help match careers - not limit them.
    - Make course URLs properly formatted as markdown links: [Course Name](URL)
    """
    
    result = llm.invoke(prompt)
    return getattr(result, "content", str(result))


def generate_personalized_followup_questions(request) -> dict:
    """
    Generate 5-6 personalized follow-up questions based on all 4 forms data.
    These questions help gather deeper insights about the user's career motivations,
    work-life balance needs, and growth preferences based on their complete profile.
    """
    llm = _get_llm()
    
    # Interpret mental health levels for context
    gad_level = "minimal" if request.gad_total_score <= 4 else "mild" if request.gad_total_score <= 9 else "moderate" if request.gad_total_score <= 14 else "significant"
    phq_level = "minimal" if request.phq_total_score <= 4 else "mild" if request.phq_total_score <= 9 else "moderate" if request.phq_total_score <= 14 else "significant"
    
    # Holland code personality descriptions
    holland_descriptions = {
        'R': 'Realistic - practical, hands-on work',
        'I': 'Investigative - analytical thinking',
        'A': 'Artistic - creative expression',
        'S': 'Social - helping others',
        'E': 'Enterprising - leadership',
        'C': 'Conventional - organized, systematic'
    }
    
    primary_holland = request.holland_code[0] if request.holland_code else 'I'
    holland_desc = holland_descriptions.get(primary_holland, 'balanced')
    
    prompt = f"""
    You are PathFinder Pro, an expert career psychologist creating PERSONALIZED follow-up questions.
    
    ## Complete User Profile (from 4 previous forms):
    
    **Basic Info (Form 1):**
    - Name: {request.full_name}
    - Education: {request.education_level}
    - Target Role: {request.target_role}
    - Skills: {', '.join(request.skills) if request.skills else 'Not specified'}
    - Country: {request.country}
    
    **Career Personality (Form 2):**
    - Holland Code: {request.holland_code} ({holland_desc})
    - Career Interests: {', '.join(request.interests) if request.interests else 'General career growth'}
    - Work Preferences: {request.work_preferences}
    
    **Mental Health Context (Forms 3 & 4):**
    - Anxiety Level (GAD-7): {request.gad_total_score}/21 ({gad_level})
    - Mood Level (PHQ-9): {request.phq_total_score}/27 ({phq_level})
    - Severity Context: {request.gad_severity} anxiety, {request.phq_severity} mood indicators
    
    ## Your Task:
    
    Generate exactly 6 DEEPLY PERSONALIZED follow-up questions that:
    1. Are specifically tailored to THIS user's profile, not generic
    2. Probe deeper into their career motivations and decision-making style
    3. Consider their mental health indicators when asking about stress/pace
    4. Explore work-life balance needs based on their Holland Code
    5. Help understand their growth mindset and learning preferences
    6. Each question must reference something specific from their profile
    
    ## Question Categories to Cover:
    - Career Motivation (why they chose {request.target_role})
    - Decision-Making Style (based on their {primary_holland} personality)
    - Work Environment Fit (considering their {gad_level} anxiety level)
    - Growth & Learning (based on their skills: {', '.join(request.skills[:3]) if request.skills else 'their background'})
    - Life-Work Balance (considering their {phq_level} mood indicators)
    - Future Vision (5-year career goals in {request.country})
    
    ## Response Format:
    
    Respond ONLY with valid JSON in this exact format:
    {{
        "questions": [
            {{
                "id": 1,
                "question": "Specific personalized question mentioning their profile details...",
                "category": "Career Motivation",
                "context": "Why this question matters for their journey to become a {request.target_role}",
                "options": [
                    "Option A - specific to their situation",
                    "Option B - alternative perspective", 
                    "Option C - another relevant choice",
                    "Option D - contrasting viewpoint",
                    "Option E - open-ended or 'Other'"
                ]
            }}
        ],
        "personalization_note": "A 2-sentence explanation of why these specific questions were chosen for {request.full_name} based on their complete profile."
    }}
    
    ## CRITICAL RULES:
    - Each question MUST reference their specific profile (name, role, skills, scores)
    - Provide exactly 5 multiple-choice options per question
    - Options should be mutually exclusive and cover the spectrum of responses
    - Questions should be supportive and growth-oriented, NOT clinical
    - Consider their mental health scores when framing questions about stress/pressure
    - Make questions conversational but insightful
    """
    
    try:
        result = llm.invoke(prompt)
        text = getattr(result, "content", str(result))
        
        # Parse JSON response
        def _parse_json(raw: str):
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                cleaned = raw.strip().strip("`")
                if cleaned.lower().startswith("json"):
                    cleaned = cleaned[4:].lstrip()
                return json.loads(cleaned)
        
        data = _parse_json(text)
        return {
            "questions": data.get("questions", []),
            "personalization_note": data.get("personalization_note", ""),
            "success": True
        }
        
    except Exception as e:
        print(f"Personalized questions generation error: {e}")
        # Return fallback questions that are still somewhat personalized
        return {
            "questions": [
                {
                    "id": 1,
                    "question": f"What initially drew you to pursue a career as a {request.target_role}?",
                    "category": "Career Motivation",
                    "context": f"Understanding your motivation helps us align career advice with your core values",
                    "options": [
                        "Passion for the technical challenges",
                        "Good salary and job security",
                        "Desire to make an impact",
                        "Natural progression from my education",
                        "Influenced by role models or mentors"
                    ]
                },
                {
                    "id": 2,
                    "question": f"Given your {request.holland_code} personality type, how do you prefer to tackle complex problems at work?",
                    "category": "Decision-Making Style",
                    "context": f"Your Holland Code ({request.holland_code}) suggests specific problem-solving preferences",
                    "options": [
                        "Analyze data thoroughly before deciding",
                        "Trust my intuition and experience",
                        "Collaborate with team members",
                        "Experiment with creative solutions",
                        "Follow established procedures"
                    ]
                },
                {
                    "id": 3,
                    "question": f"Considering your current skill set ({', '.join(request.skills[:3]) if request.skills else 'technical background'}), what's your preferred way to learn new technologies?",
                    "category": "Growth & Learning",
                    "context": "Understanding your learning style helps us recommend the right resources",
                    "options": [
                        "Online courses with structured curriculum",
                        "Hands-on projects and building things",
                        "Reading documentation and tutorials",
                        "Mentorship and peer learning",
                        "Certification programs"
                    ]
                },
                {
                    "id": 4,
                    "question": f"What does an ideal work-life balance look like for you as a {request.target_role}?",
                    "category": "Life-Work Balance",
                    "context": "This helps us recommend work environments that support your wellbeing",
                    "options": [
                        "Clear boundaries - work stays at work",
                        "Flexible hours with outcome focus",
                        "High intensity periods balanced with rest",
                        "Integration of work and personal interests",
                        "Minimal overtime with predictable schedule"
                    ]
                },
                {
                    "id": 5,
                    "question": f"Where do you see yourself in 5 years in your {request.target_role} career in {request.country or 'your region'}?",
                    "category": "Future Vision",
                    "context": "Long-term vision helps us provide strategic career guidance",
                    "options": [
                        "Technical expert and thought leader",
                        "Team lead or manager",
                        "Starting my own venture",
                        "Transitioning to a related specialized field",
                        "Achieving work-life harmony with stable growth"
                    ]
                },
                {
                    "id": 6,
                    "question": "How do you typically handle setbacks or challenges in your career journey?",
                    "category": "Resilience & Mindset",
                    "context": f"Understanding your resilience helps us provide appropriate support strategies",
                    "options": [
                        "View them as learning opportunities",
                        "Seek support from mentors or peers",
                        "Take time to process before moving forward",
                        "Pivot and try different approaches",
                        "Focus on what I can control"
                    ]
                }
            ],
            "personalization_note": f"These questions are designed to understand {request.full_name}'s unique career journey toward becoming a {request.target_role}, considering their {request.holland_code} personality and wellbeing profile.",
            "success": True
        }


    
# ========== LIVE AI-POWERED DASHBOARD FEATURES ==========

def generate_personalized_market_trends(skills: list, target_role: str, holland_code: str) -> dict:
    """
    Generate AI-powered market trends personalized to the user's profile.
    Uses Gemini to analyze which career paths are most relevant based on user skills.
    """
    llm = _get_llm()
    
    skills_str = ", ".join(skills) if skills else "general tech skills"
    
    prompt = f"""
    You are a career market analyst. Based on the user's profile, provide personalized job market trends.
    
    User Profile:
    - Current Skills: {skills_str}
    - Target Role: {target_role or "Not specified"}
    - Holland Code (Personality): {holland_code or "Not specified"}
    
    Analyze current 2024-2025 job market trends and provide 4-5 career paths that are:
    1. Relevant to their current skills
    2. Aligned with their target role (if specified)
    3. In high demand with good growth potential
    
    Respond ONLY with valid JSON in this exact format:
    {{
        "trends": [
            {{
                "label": "Career Path Name",
                "demand": 85,
                "salary": "High",
                "relevance": "Why this is relevant to user's skills",
                "growth": "+22% YoY"
            }}
        ],
        "insight": "A personalized 1-2 sentence insight about the user's market position"
    }}
    
    Rules:
    - demand: number 50-99 (percentage of market demand)
    - salary: "High", "Medium-High", "Medium", or "Low"
    - growth: Include YoY growth like "+15% YoY" or "Stable"
    - Order trends by relevance to user's profile (most relevant first)
    - Be specific about why each trend matters for THIS user
    """
    
    try:
        result = llm.invoke(prompt)
        text = getattr(result, "content", str(result))
        
        # Parse JSON
        def _parse_json(raw: str):
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                cleaned = raw.strip().strip("`")
                if cleaned.lower().startswith("json"):
                    cleaned = cleaned[4:].lstrip()
                return json.loads(cleaned)
        
        data = _parse_json(text)
        return {
            "trends": data.get("trends", []),
            "insight": data.get("insight", ""),
            "success": True
        }
    except Exception as e:
        print(f"Market trends generation error: {e}")
        # Return fallback trends
        return {
            "trends": [
                {"label": "AI & Machine Learning", "demand": 94, "salary": "High", "relevance": f"Highly relevant for {target_role or 'tech careers'}", "growth": "+28% YoY"},
                {"label": "Data Analytics", "demand": 88, "salary": "High", "relevance": "Growing demand across industries", "growth": "+22% YoY"},
                {"label": "Cloud Computing", "demand": 85, "salary": "High", "relevance": "Essential for modern tech roles", "growth": "+18% YoY"},
                {"label": "Cybersecurity", "demand": 82, "salary": "High", "relevance": "Critical skill gap in the market", "growth": "+15% YoY"},
            ],
            "insight": f"Based on your skills in {skills_str}, you're well-positioned for the growing tech market.",
            "success": True
        }


def generate_skill_gap_courses(skill_gaps: list, target_role: str, current_skills: list) -> dict:
    """
    Generate AI-powered course recommendations for skill gaps.
    Uses Gemini to recommend specific courses with real links.
    """
    llm = _get_llm()
    
    gaps_str = ", ".join(skill_gaps) if skill_gaps else "general upskilling"
    current_str = ", ".join(current_skills) if current_skills else "beginner level"
    
    prompt = f"""
    You are a career learning specialist. Recommend specific courses for the user's skill gaps.
    
    User Profile:
    - Target Role: {target_role or "Software Professional"}
    - Current Skills: {current_str}
    - Skills to Learn: {gaps_str}
    
    For each skill gap, recommend ONE specific, high-quality course.
    
    Respond ONLY with valid JSON in this exact format:
    {{
        "courses": [
            {{
                "skill": "Skill Name",
                "course_name": "Specific Course Title (e.g. 'The Complete Python Bootcamp')",
                "platform": "Coursera or Udemy",
                "link": "https://www.udemy.com/course/complete-python-bootcamp/ (Exact link if known)",
                "duration": "4 weeks",
                "level": "Beginner",
                "why_learn": "Why this skill matters for their target role"
            }}
        ],
        "learning_path_summary": "A 1-2 sentence overview of the recommended learning journey"
    }}
    
    Rules:
    1. PRIORITIZE EXACT COURSE URLs to popular, best-selling courses if you know them.
       - Example: https://www.udemy.com/course/the-complete-web-development-bootcamp/
       - Example: https://www.coursera.org/learn/machine-learning
    2. If you don't know the exact deeply-linked URL, use a high-quality search link:
       - Udemy: https://www.udemy.com/courses/search/?q=EXACT_COURSE_NAME
       - Coursera: https://www.coursera.org/search?query=EXACT_COURSE_NAME
    3. Use REAL platforms: Coursera, Udemy, LinkedIn Learning, edX
    4. Provide specific course names, not just "Learn Python".
    """
    
    try:
        result = llm.invoke(prompt)
        text = getattr(result, "content", str(result))
        
        # Parse JSON
        def _parse_json(raw: str):
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                cleaned = raw.strip().strip("`")
                if cleaned.lower().startswith("json"):
                    cleaned = cleaned[4:].lstrip()
                return json.loads(cleaned)
        
        data = _parse_json(text)
        return {
            "courses": data.get("courses", []),
            "learning_path_summary": data.get("learning_path_summary", ""),
            "success": True
        }
    except Exception as e:
        print(f"Skill courses generation error: {e}")
        # Return fallback courses for each skill gap
        courses = []
        for gap in skill_gaps[:5]:  # Limit to 5 skills
            skill_encoded = gap.replace(" ", "+").lower()
            courses.append({
                "skill": gap,
                "course_name": f"{gap} Fundamentals",
                "platform": "Coursera",
                "link": f"https://www.coursera.org/search?query={skill_encoded}",
                "duration": "4-6 weeks",
                "level": "Beginner",
                "why_learn": f"Essential skill for {target_role or 'career growth'}"
            })
        
        return {
            "courses": courses,
            "learning_path_summary": f"Start with fundamentals and build towards {target_role or 'your career goals'}.",
            "success": True
        }