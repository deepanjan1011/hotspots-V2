
import os
import openai
import azure.cognitiveservices.speech as speechsdk
from fastapi import HTTPException

# Azure OpenAI Configuration
OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
OPENAI_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")

# Azure Speech Configuration
SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY")
SPEECH_REGION = os.getenv("AZURE_SPEECH_REGION")

def generate_heat_plan(data: dict):
    """
    Generates a personalized heat resilience plan using Azure OpenAI.
    """
    if not OPENAI_API_KEY or not OPENAI_ENDPOINT:
        # Mock response for demo purposes (when Azure keys are missing)
        return {
            "plan": f"""**Heat Resilience Plan for {data.get('city', 'Selected Location')}**

1. **Green Roof Implementation**:
   - The building density ({data.get('bldDensity', '0'):.2f}) indicates high heat retention. Install modular green roofs to reduce surface temperature by up to 15°C.

2. **Perpendicular Shading**:
   - With an NDVI of {data.get('ndvi', '0'):.2f}, vegetation is sparse. Construct perpendicular shading structures along walkways to maximize pedestrian comfort.

3. **Cool Pavement Materials**:
   - Vulnerability score is {data.get('vulnerability', '0'):.2f} (High). Resurface parking areas with high-albedo cool pavement to reflect solar radiation.""",
            "is_mock": True
        }

    client = openai.AzureOpenAI(
        api_key=OPENAI_API_KEY,
        api_version="2024-02-15-preview",
        azure_endpoint=OPENAI_ENDPOINT
    )

    prompt = f"""
    You are a Heat Resilience Expert. Analyze the following data point in {data.get('city', 'the city')}:
    - Vulnerability Score: {data.get('vulnerability', 'N/A')}
    - Building Density: {data.get('bldDensity', 'N/A')}
    - NDVI (Green Cover): {data.get('ndvi', 'N/A')}

    Provide a concise, numbered list of 3 actionable mitigation strategies for this specific location.
    Make it sound professional but urgent.
    """

    try:
        response = client.chat.completions.create(
            model=OPENAI_DEPLOYMENT_NAME,
            messages=[
                {"role": "system", "content": "You are a helpful expert assistant."},
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
    if not SPEECH_KEY or not SPEECH_REGION:
        raise HTTPException(status_code=500, detail="Azure Speech keys are missing.")

    speech_config = speechsdk.SpeechConfig(subscription=SPEECH_KEY, region=SPEECH_REGION)
    speech_config.speech_synthesis_voice_name = 'en-US-AvaMultilingualNeural' # Modern AI Voice

    # We want to return the audio bytes, not play it on the server speakers
    # So we don't set an audio output config (defaults to memory/stream mostly, but let's be explicit)
    # pull_stream = speechsdk.audio.PullAudioOutputStream()
    # audio_config = speechsdk.audio.AudioConfig(stream=pull_stream)
    
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
        raise HTTPException(status_code=500, detail="Speech synthesis failed.")
