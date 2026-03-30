
import os
import openai
from fastapi import HTTPException

# NOTE: azure.cognitiveservices.speech is imported lazily inside text_to_speech()
# because it uses native C++ binaries unavailable on Vercel's serverless environment.
# Importing at module level would crash ALL endpoints, not just speak-plan.

# Azure OpenAI Configuration
OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
OPENAI_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")

# Azure Speech Configuration
SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY")
SPEECH_REGION = os.getenv("AZURE_SPEECH_REGION")

def _to_float(value, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default

def generate_heat_plan(data: dict):
    """
    Generates a personalized heat resilience plan using Azure OpenAI.
    """
    if not OPENAI_API_KEY or not OPENAI_ENDPOINT:
        # Mock response for demo purposes (when Azure keys are missing)
        bld = _to_float(data.get("bldDensity"), 0.0)
        ndvi = _to_float(data.get("ndvi"), 0.0)
        vuln = _to_float(data.get("vulnerability"), 0.0)
        return {
            "plan": f"""**Heat Resilience Plan for {data.get('city', 'Selected Location')}**

1. **Green Roof Implementation**:
   - The building density ({bld:.2f}) indicates high heat retention. Install modular green roofs to reduce surface temperature by up to 15°C.

2. **Perpendicular Shading**:
   - With an NDVI of {ndvi:.2f}, vegetation is sparse. Construct perpendicular shading structures along walkways to maximize pedestrian comfort.

3. **Cool Pavement Materials**:
   - Vulnerability score is {vuln:.2f} (High). Resurface parking areas with high-albedo cool pavement to reflect solar radiation.""",
            "is_mock": True
        }

    client = openai.AzureOpenAI(
        api_key=OPENAI_API_KEY,
        api_version="2024-02-15-preview",
        azure_endpoint=OPENAI_ENDPOINT
    )

    prompt = f"""
    You are an elite urban climate adaptation specialist generating a Heat Resilience Plan for a specific location in {data.get('city', 'the city')}.
    
    ENVIRONMENTAL METRICS AT THIS LOCATION:
    - Heat Vulnerability (0-1): {data.get('vulnerability', 'N/A')}
    - Building Density (0-1): {data.get('bldDensity', 'N/A')}
    - NDVI (Green Cover) (-1 to 1): {data.get('ndvi', 'N/A')}
    - Predicted AQI: {data.get('aqi', 'N/A')}
    - Combined Health Risk: {data.get('health_risk', 'N/A')}

    CRITICAL INSTRUCTIONS:
    1. Provide a concise, numbered list of 3 highly actionable mitigation strategies tailored SPECIFICALLY to these exact metrics in {data.get('city', 'this region')}.
    2. DO NOT provide generic answers. For example, if suggesting plants, name specific native species that survive the given AQI and Heat Vulnerability. If highlighting architectural changes, mention strategies specific to the given building density.
    3. Make it sound professional but urgent.
    4. IMPORTANT: Do NOT use markdown formatting (like **bold** or *italics*). Use plain text only.
    5. Use clear numbering like "1. Strategy Name: Description".
    """

    try:
        response = client.chat.completions.create(
            model=OPENAI_DEPLOYMENT_NAME,
            messages=[
                {"role": "system", "content": "You are a specialized urban climate adaptation expert."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=300
        )
        return {"plan": response.choices[0].message.content, "is_mock": False}
    except Exception as e:
        print(f"Error generating plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def text_to_speech(text: str):
    """
    Converts text to speech using Azure AI Speech.
    Returns the audio data as a stream or saves to a temp file.
    """
    # Lazy import: this SDK uses native C++ binaries unavailable on Vercel
    try:
        import azure.cognitiveservices.speech as speechsdk
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="Text-to-speech is not available in this deployment (Azure Speech SDK requires native binaries)."
        )

    if not SPEECH_KEY or not SPEECH_REGION:
        raise HTTPException(status_code=500, detail="Azure Speech keys are missing.")

    speech_config = speechsdk.SpeechConfig(subscription=SPEECH_KEY, region=SPEECH_REGION)
    speech_config.speech_synthesis_voice_name = 'en-US-AvaMultilingualNeural' # Modern AI Voice

    # Simpler approach for web API: Synthesis to memory
    synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)

    result = synthesizer.speak_text_async(text).get()

    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
        return result.audio_data
    elif result.reason == speechsdk.ResultReason.Canceled:
        cancellation_details = result.cancellation_details
        print(f"Speech synthesis canceled: {cancellation_details.reason}")
        if cancellation_details.reason == speechsdk.CancellationReason.Error:
            print(f"Error details: {cancellation_details.error_details}")
            raise HTTPException(
                status_code=500,
                detail=f"Speech synthesis failed: {cancellation_details.error_details}",
            )
        raise HTTPException(status_code=500, detail="Speech synthesis failed.")

def chat_with_expert(message: str, history: list, context_data: dict = None):
    """
    Chat with the Heat Resilience Expert using context from the generated plan.
    """
    if not OPENAI_API_KEY or not OPENAI_ENDPOINT:
        # Mock response
        return "I am a simulated expert. Azure OpenAI keys are missing, so I cannot answer specific questions yet. (Mock Mode)"

    client = openai.AzureOpenAI(
        api_key=OPENAI_API_KEY,
        api_version="2024-02-15-preview",
        azure_endpoint=OPENAI_ENDPOINT
    )

    # Build system context
    system_prompt = f"""You are an elite urban climate adaptation specialist and botanist consulting for {context_data.get('city', 'the city') if context_data else 'cities'}.
    User is asking about a location with the following environmental metrics:
    - Heat Vulnerability (0-1): {context_data.get('vulnerability', 'Unknown') if context_data else 'Unknown'}
    - Building Density (0-1): {context_data.get('bldDensity', 'Unknown') if context_data else 'Unknown'}
    - NDVI (Green Cover) (-1 to 1): {context_data.get('ndvi', 'Unknown') if context_data else 'Unknown'}
    - Predicted AQI: {context_data.get('aqi', 'Unknown') if context_data else 'Unknown'}
    - Combined Health Risk (0-1): {context_data.get('health_risk', 'Unknown') if context_data else 'Unknown'}
    
    CRITICAL INSTRUCTIONS:
    1. DO NOT GIVE GENERIC ADVICE. You MUST tailor your recommendations specifically to the metrics provided above.
    2. If the user asks for plants, suggest specific species that are native or highly adapted to the climate of {context_data.get('city', 'the region') if context_data else 'the region'} and capable of surviving the specific AQI and Heat Vulnerability levels provided. Do not just say "plant a tree".
    3. Keep answers concise, actionable, and highly professional. Limit to 3-4 sentences maximum.
    """

    messages = [{"role": "system", "content": system_prompt}]
    
    # Add history (limit to last 6 messages to save tokens)
    for msg in history[-6:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    
    # Add current user message
    messages.append({"role": "user", "content": message})

    try:
        response = client.chat.completions.create(
            model=OPENAI_DEPLOYMENT_NAME,
            messages=messages,
            max_tokens=200
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
