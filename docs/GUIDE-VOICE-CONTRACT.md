# Guide voice contract · 0.1.13

Shared release 0.1.13 adds an explicit, foreground voice session to the existing field conversation. The exact shared assets and bounded validation are recorded in [the release receipt](../qa/field-release-0.1.13.json).

## Actual flow

Start checks the current carrier’s on-device recognition availability before requesting recognition. Android language support remains unknown where its API does not establish it. Mute aborts capture; Listen explicitly starts another recognition turn. End, hidden workspace, changed source address/revision, application blur, hidden document and unmount invalidate pending callbacks and stop owned capture/speech. No remote recognition fallback is selected and no language pack is automatically downloaded.

Only final recognition results enter the transcript queue. They retain session/occurrence IDs, original selected address/revision/source ID, provider, language and exact returned text. The browser does not expose original audio through this API, so `rawAudioRetained:false` is explicit. A transcript is a recognizer's result, not an audio-authenticity proof.

The user chooses a transcript into the existing composer and retains it through the existing atomic source/readback/commit path. Its source realm is `local-speech-transcript`, distinct from Android Share/Process Text. Recognition never dispatches arbitrary commands. Original recognized text remains in the voice event ticket even if a later composer edit changes the retained message.

Spoken output is limited to actual retained conversation replies or currently available, user-authored guide steps. The selected source text must still match at activation. Local speech voices only are accepted. The microphone is stopped while speaking, and the provider's actual end event produces a source-bound playback ticket. That event does not establish that the user heard or understood the output.

## Remaining dependency

The current conversation mechanism still produces `reply:null`. This candidate supplies speech transport and source-linked playback; it does not supply a general meaning/intent or reply-generation engine. No stock answer is substituted. Native recognition availability is carrier-specific, and physical microphone/speaker behavior remains a device test.

## API basis

- [On-device recognition setting](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally)
- [Installed local recognition availability](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static)
- [Local versus remote synthesis voice](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService)
- [Actual speech end callback](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/end_event)

Controlled tests inject a local provider and do not open a microphone. They cover cancellation during availability, mute/resume, final-result deduplication, source scope, stale callbacks, speech cancellation, no automatic restart, unavailable local APIs and exact atomic transcript provenance. These tests are not recognition-quality or physical-device evidence.

## Native bridges

Windows and Android share the same client operation/cursor/cancellation loop, with separate validators and truthful provider metadata. HOMEBASE uses only its fixed local POST route. Android uses only the intercepted local GET route with bounded encoded JSON because WebResourceRequest does not expose POST bodies. Stop acknowledgments retain the original scope and are returned to the call history. Windows waits for child-process exit; Android reports its cancel/destroy/TTS-stop API return, with hardware-stop verification false.

Windows System.Speech requires an installed supported local engine and voice. Its C# helper has not been compiled or exercised on a Windows device in this cloud environment. No runtime installation or global renderer microphone grant is included. Android uses API31+ on-device recognition and installed non-network TTS voices, with an explicit microphone permission flow; a stale permission result cannot start audio. Native/provider metadata is not hardware attestation.

## Tested resource and cancellation boundaries

The shared controller retains up to 64 final transcripts per call and rejects oversized or extra results explicitly. Native envelopes carry bounded event history and exact original scope. End arriving before Android availability reserves an ended session without creating resources; it cannot stop another session. HOMEBASE End after a completed cancellation truthfully returns no-child-active. Neither acknowledgment is relabeled as physical hardware verification.

The native bridges and shared client use the same source context and ordered operation IDs, while preserving their actual provider-specific receipts. Android retains up to seven additional returned transcript alternatives with explicit counts and omission metadata. No retained transcript is silently shortened.
