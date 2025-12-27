# Project Riko 

#### **Patreon Version:**  *Windows version 1.0 2025-07-22*
Project Riko is a anime focused LLM project by Just Rayen. She listens, and remembers your conversations. It combines OpenAI’s GPT, GPT-SoVITS voice synthesis, and Faster-Whisper ASR into a fully configurable conversational pipeline. 


**tested with python 3.10 Windows >10**
## ✨ Features

- 💬 **LLM-based dialogue** using OpenAI API (configurable system prompts)
- **VRM animated avartar**
- 🧠 **Conversation memory** to keep context during interactions
- 🔊 **Voice generation** via GPT-SoVITS API
- 🎧 **Speech recognition** using Faster-Whisper
- 📁 Clean YAML-based config for personality configuration


## ⚙️ Configuration

All prompts and parameters are stored in `config.yaml`.
You can define personalities by modiying the config file.

```yaml
waifu_name: riko
gpu_acceleration: cpu 
history_file: chat_history.json
model: "gpt-4.1-mini"
presets:
  default:
    system_prompt: |
      You are a helpful assistant named Riko.
      You speak like a snarky anime girl.
      Always refer to the user as "senpai.

asr_context: The following is a conversation between Rayen and Riko
sovits_ping_config:
  text_lang: en
  prompt_lang : en
  ref_audio_path : D:\PyProjects\waifu_project\riko_project_patreon\character_files\main_sample.wav
  prompt_text : This is a sample voice for you to just get started with because it sounds kind of cute but just make sure this doesn't have long silences.

# THE FOLLOWING IS FOR SOVITS V2, V2PRO, V2PROPLUS   
  
  # additional_aud :
  # - additional_audio1
  # - additional_audio2
  
````

## 🛠️ Setup

### Install Dependencies

1. Set up python 3.10 venv
2. Run the folowing manually

### Manual Install 


```bash
pip install uv 
uv pip install -r requirements.txt

cd client
npm install three @pixiv/three-vrm @pixiv/three-vrm-animation
```

**If you want to use GPU support for Faster whisper** Make sure you also have:

* CUDA & cuDNN installed correctly (for Faster-Whisper GPU support)
* `ffmpeg` installed (for audio processing)


### Create .env file and place it in the root directory 
```text
OPENAI_API_KEY= "sk-proj-YOUR_API_key"
```

## 🧪 Usage

### 1. Launch the GPT-SoVITS API 

Install GPT-SoVITS and double click on api_v2.bat to launch the API

### 2. Run the main script:


```bash
# first activate virtual environment 
cd riko_project_patreon 
cd server 
python server.py
# to launch the frontend
cd client
npx vite
# launch the main chat
python main_chat.py
```

The flow:

1. Riko listens to your voice via microphone (push to talk)
2. Transcribes it with Faster-Whisper
3. Passes it to GPT (with history)
4. Generates a response
5. Synthesizes Riko's voice using GPT-SoVITS
6. Plays the output back to you
7. Animates the avatar using three-VRM


## 📌 TODO / Future Improvements

* [ ] GUI or web interface
* [x] Live microphone input support
* [ ] Emotion or tone control in speech synthesis
* [x] VRM model frontend


## 🧑‍🎤 Credits

* Voice synthesis powered by [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS)
* ASR via [Faster-Whisper](https://github.com/SYSTRAN/faster-whisper)
* Language model via [OpenAI GPT](https://platform.openai.com)
* Animations using [Three-VRM](https://github.com/pixiv/three-vrm)


## ⚠️ License Notice:
This version is for personal use only.
Do not redistribute, sell, or share the code — it’s under a custom early access license.
A public open-source release will come later.

Enjoy~  
—Rayen 💻✨

