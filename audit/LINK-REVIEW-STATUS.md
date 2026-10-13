# Reference link review — current evidence

> Status snapshot: 2026-10-10. This records repository-side inspection evidence only; it is not a claim that every linked source file, live service, or external page has been exhaustively audited.

## Scope and limits

- The available extracted manifest contains **138 unique GitHub repository slugs**. GitHub API metadata (description, language/license where provided, activity, and README excerpt) was collected for 134; four requests returned HTTP 404. A 404 does not establish whether a repository is private, renamed, deleted, or misspelled.
- **40 selected README/document files** were fetched for deeper reading across 26 selected repositories. That is targeted document review—not a source-code, dependency, security, license-compliance, or runtime audit of every repository.
- Several reference families are represented in those deeper reads: CRM/quotations, marketing plans/copy, API/OpenAPI intake, diagram design, education, and video/media. No code or third-party asset was copied into this project based solely on these references.
- The supplied Facebook page and other non-GitHub websites were not fetched in this environment; their content remains unverified. The UI links to the Facebook URL only as the user-provided reference. A full inventory of the latest expanded/repetitive list is not recoverable from the current chat context; this report reflects the available 138-slug manifest only.

## Selected deeper document reads

The 40 fetched README/document files corresponded to these 26 repositories: `ArnasDon/wacrm`; `Augani/openreel-video`; `Bhawana0218/NextStep-Abroad`; `Django-CRM/Django-CRM`; `Nabaleducation/EducationConsultancyWebsite`; `THU-MAIC/OpenMAIC`; `ToolJet/ToolJet`; `arupdas0825/studytra`; `cathrynlavery/diagram-design`; `clawnify/OpenProspector`; `coreyhaines31/marketingskills`; `cursor/plugins`; `every-app/open-seo`; `frappe/crm`; `guifav/market-intelligence-radar`; `heygen-com/hyperframes`; `huggingface/education-toolkit`; `idurar/idurar-erp-crm`; `melgarafael/DeskcommCRM`; `omacom/omarchy`; `parthasarathy123/n8n-gtm-lead-enrichment`; `public-apis/public-apis`; `remotion-dev/remotion`; `trycompai/crm`; `tt-a1i/archify`; `twentyhq/twenty`. The deeper files covered selected topics such as diagram design, marketing plan/ad/email/social templates, CRM architecture/security/schema, and OpenAPI intake; other fetched files were README-level.

**Specific limitations preserved:** ToolJet was identified as AGPL-3.0; no source was copied. The three `engralaminn-collab` repositories and the truncated/inferred `VonHoltenCodes/SlowBooksPro` target returned 404; their actual state is unresolved. The URLs were not guessed into a successful verification.

## Available repository manifest

| Repository | GitHub URL | Result |
|---|---|---|
| `ToolJet/ToolJet` | [https://github.com/ToolJet/ToolJet](https://github.com/ToolJet/ToolJet) | API metadata + README excerpt; not full source audit |
| `huggingface/education-toolkit` | [https://github.com/huggingface/education-toolkit](https://github.com/huggingface/education-toolkit) | API metadata + README excerpt; not full source audit |
| `omacom/omarchy` | [https://github.com/omacom/omarchy](https://github.com/omacom/omarchy) | API metadata + README excerpt; not full source audit |
| `cathrynlavery/diagram-design` | [https://github.com/cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) | API metadata + README excerpt; not full source audit |
| `cursor/plugins` | [https://github.com/cursor/plugins](https://github.com/cursor/plugins) | API metadata + README excerpt; not full source audit |
| `AprilNEA/OpenLogi` | [https://github.com/AprilNEA/OpenLogi](https://github.com/AprilNEA/OpenLogi) | API metadata + README excerpt; not full source audit |
| `volcengine/OpenViking` | [https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking) | API metadata + README excerpt; not full source audit |
| `debpalash/VoiceStudio` | [https://github.com/debpalash/VoiceStudio](https://github.com/debpalash/VoiceStudio) | API metadata + README excerpt; not full source audit |
| `akitaonrails/ai-memory` | [https://github.com/akitaonrails/ai-memory](https://github.com/akitaonrails/ai-memory) | API metadata + README excerpt; not full source audit |
| `Lakr233/vphone-cli` | [https://github.com/Lakr233/vphone-cli](https://github.com/Lakr233/vphone-cli) | API metadata + README excerpt; not full source audit |
| `public-apis/public-apis` | [https://github.com/public-apis/public-apis](https://github.com/public-apis/public-apis) | API metadata + README excerpt; not full source audit |
| `harry0703/MoneyPrinterTurbo` | [https://github.com/harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | API metadata + README excerpt; not full source audit |
| `blader/humanizer` | [https://github.com/blader/humanizer](https://github.com/blader/humanizer) | API metadata + README excerpt; not full source audit |
| `heygen-com/hyperframes` | [https://github.com/heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | API metadata + README excerpt; not full source audit |
| `every-app/open-seo` | [https://github.com/every-app/open-seo](https://github.com/every-app/open-seo) | API metadata + README excerpt; not full source audit |
| `ruvnet/ruflo` | [https://github.com/ruvnet/ruflo](https://github.com/ruvnet/ruflo) | API metadata + README excerpt; not full source audit |
| `coreyhaines31/marketingskills` | [https://github.com/coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | API metadata + README excerpt; not full source audit |
| `mksglu/context-mode` | [https://github.com/mksglu/context-mode](https://github.com/mksglu/context-mode) | API metadata + README excerpt; not full source audit |
| `fmtlib/fmt` | [https://github.com/fmtlib/fmt](https://github.com/fmtlib/fmt) | API metadata + README excerpt; not full source audit |
| `affaan-m/ECC` | [https://github.com/affaan-m/ECC](https://github.com/affaan-m/ECC) | API metadata + README excerpt; not full source audit |
| `alsk1992/CloddsBot` | [https://github.com/alsk1992/CloddsBot](https://github.com/alsk1992/CloddsBot) | API metadata + README excerpt; not full source audit |
| `nashsu/llm_wiki` | [https://github.com/nashsu/llm_wiki](https://github.com/nashsu/llm_wiki) | API metadata + README excerpt; not full source audit |
| `vastsa/PI-Desktop` | [https://github.com/vastsa/PI-Desktop](https://github.com/vastsa/PI-Desktop) | API metadata + README excerpt; not full source audit |
| `armory3d/armorpaint` | [https://github.com/armory3d/armorpaint](https://github.com/armory3d/armorpaint) | API metadata + README excerpt; not full source audit |
| `anthropics/claude-plugins-community` | [https://github.com/anthropics/claude-plugins-community](https://github.com/anthropics/claude-plugins-community) | API metadata + README excerpt; not full source audit |
| `Nabaleducation/EducationConsultancyWebsite` | [https://github.com/nabaleducation/EducationConsultancyWebsite](https://github.com/nabaleducation/EducationConsultancyWebsite) | API metadata + README excerpt; not full source audit |
| `arupdas0825/studytra` | [https://github.com/arupdas0825/studytra](https://github.com/arupdas0825/studytra) | API metadata + README excerpt; not full source audit |
| `Bhawana0218/NextStep-Abroad` | [https://github.com/Bhawana0218/NextStep-Abroad](https://github.com/Bhawana0218/NextStep-Abroad) | API metadata + README excerpt; not full source audit |
| `DIYgod/RSSHub` | [https://github.com/DIYgod/RSSHub](https://github.com/DIYgod/RSSHub) | API metadata + README excerpt; not full source audit |
| `siyuan-note/siyuan` | [https://github.com/siyuan-note/siyuan](https://github.com/siyuan-note/siyuan) | API metadata + README excerpt; not full source audit |
| `ioi-labs/molx` | [https://github.com/ioi-labs/molx](https://github.com/ioi-labs/molx) | API metadata + README excerpt; not full source audit |
| `firecrawl/firecrawl` | [https://github.com/firecrawl/firecrawl](https://github.com/firecrawl/firecrawl) | API metadata + README excerpt; not full source audit |
| `firecrawl/web-agent` | [https://github.com/firecrawl/web-agent](https://github.com/firecrawl/web-agent) | API metadata + README excerpt; not full source audit |
| `guifav/market-intelligence-radar` | [https://github.com/guifav/market-intelligence-radar](https://github.com/guifav/market-intelligence-radar) | API metadata + README excerpt; not full source audit |
| `parthasarathy123/n8n-gtm-lead-enrichment` | [https://github.com/parthasarathy123/n8n-gtm-lead-enrichment](https://github.com/parthasarathy123/n8n-gtm-lead-enrichment) | API metadata + README excerpt; not full source audit |
| `brightdata/open-enrich` | [https://github.com/brightdata/open-enrich](https://github.com/brightdata/open-enrich) | API metadata + README excerpt; not full source audit |
| `clawnify/OpenProspector` | [https://github.com/clawnify/OpenProspector](https://github.com/clawnify/OpenProspector) | API metadata + README excerpt; not full source audit |
| `workwithlos-ui/dave` | [https://github.com/workwithlos-ui/dave](https://github.com/workwithlos-ui/dave) | API metadata + README excerpt; not full source audit |
| `BraaMohammed/bricks` | [https://github.com/BraaMohammed/bricks](https://github.com/BraaMohammed/bricks) | API metadata + README excerpt; not full source audit |
| `melgarafael/DeskcommCRM` | [https://github.com/melgarafael/DeskcommCRM](https://github.com/melgarafael/DeskcommCRM) | API metadata + README excerpt; not full source audit |
| `Django-CRM/Django-CRM` | [https://github.com/Django-CRM/Django-CRM](https://github.com/Django-CRM/Django-CRM) | API metadata + README excerpt; not full source audit |
| `Odoo-mobile/crm` | [https://github.com/Odoo-mobile/crm](https://github.com/Odoo-mobile/crm) | API metadata + README excerpt; not full source audit |
| `thu-ml/CRM` | [https://github.com/thu-ml/CRM](https://github.com/thu-ml/CRM) | API metadata + README excerpt; not full source audit |
| `dennisivy/crash-course-CRM` | [https://github.com/dennisivy/crash-course-CRM](https://github.com/dennisivy/crash-course-CRM) | API metadata + README excerpt; not full source audit |
| `oroinc/crm-application` | [https://github.com/oroinc/crm-application](https://github.com/oroinc/crm-application) | API metadata + README excerpt; not full source audit |
| `trycompai/crm` | [https://github.com/trycompai/crm](https://github.com/trycompai/crm) | API metadata + README excerpt; not full source audit |
| `frappe/crm` | [https://github.com/frappe/crm](https://github.com/frappe/crm) | API metadata + README excerpt; not full source audit |
| `ChurchCRM/CRM` | [https://github.com/ChurchCRM/CRM](https://github.com/ChurchCRM/CRM) | API metadata + README excerpt; not full source audit |
| `crmeb/CRMEB` | [https://github.com/crmeb/CRMEB](https://github.com/crmeb/CRMEB) | API metadata + README excerpt; not full source audit |
| `idurar/idurar-erp-crm` | [https://github.com/idurar/idurar-erp-crm](https://github.com/idurar/idurar-erp-crm) | API metadata + README excerpt; not full source audit |
| `oroinc/crm` | [https://github.com/oroinc/crm](https://github.com/oroinc/crm) | API metadata + README excerpt; not full source audit |
| `fatfreecrm/fat_free_crm` | [https://github.com/fatfreecrm/fat_free_crm](https://github.com/fatfreecrm/fat_free_crm) | API metadata + README excerpt; not full source audit |
| `engralaminn-collab/alo-education-uk-final` | [https://github.com/engralaminn-collab/alo-education-uk-final](https://github.com/engralaminn-collab/alo-education-uk-final) | HTTP 404; unresolved (not proof of private/deleted/moved) |
| `engralaminn-collab/ukvi-ai-markting_n8n` | [https://github.com/engralaminn-collab/ukvi-ai-markting_n8n](https://github.com/engralaminn-collab/ukvi-ai-markting_n8n) | HTTP 404; unresolved (not proof of private/deleted/moved) |
| `engralaminn-collab/Ai-Markting-crm` | [https://github.com/engralaminn-collab/Ai-Markting-crm](https://github.com/engralaminn-collab/Ai-Markting-crm) | HTTP 404; unresolved (not proof of private/deleted/moved) |
| `domovinatv/sms.domovina.ai` | [https://github.com/domovinatv/sms.domovina.ai](https://github.com/domovinatv/sms.domovina.ai) | API metadata + README excerpt; not full source audit |
| `NdoleStudio/httpsms` | [https://github.com/NdoleStudio/httpsms](https://github.com/NdoleStudio/httpsms) | API metadata + README excerpt; not full source audit |
| `NdoleStudio/httpsms-node` | [https://github.com/NdoleStudio/httpsms-node](https://github.com/NdoleStudio/httpsms-node) | API metadata + README excerpt; not full source audit |
| `HM-RunningHub/ComfyUI_RH_APICall` | [https://github.com/HM-RunningHub/ComfyUI_RH_APICall](https://github.com/HM-RunningHub/ComfyUI_RH_APICall) | API metadata + README excerpt; not full source audit |
| `BelledonneCommunications/linphone-iphone` | [https://github.com/BelledonneCommunications/linphone-iphone](https://github.com/BelledonneCommunications/linphone-iphone) | API metadata + README excerpt; not full source audit |
| `0perationPrivacy/VoIP` | [https://github.com/0perationPrivacy/VoIP](https://github.com/0perationPrivacy/VoIP) | API metadata + README excerpt; not full source audit |
| `YutaroHayakawa/ipftrace2` | [https://github.com/YutaroHayakawa/ipftrace2](https://github.com/YutaroHayakawa/ipftrace2) | API metadata + README excerpt; not full source audit |
| `developerspace-samples/VoIP-Call-Sample` | [https://github.com/developerspace-samples/VoIP-Call-Sample](https://github.com/developerspace-samples/VoIP-Call-Sample) | API metadata + README excerpt; not full source audit |
| `sibnerian/electron-promise-ipc` | [https://github.com/sibnerian/electron-promise-ipc](https://github.com/sibnerian/electron-promise-ipc) | API metadata + README excerpt; not full source audit |
| `tt-a1i/archify` | [https://github.com/tt-a1i/archify](https://github.com/tt-a1i/archify) | API metadata + README excerpt; not full source audit |
| `bilawalsidhu/gods-eye-view` | [https://github.com/bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view) | API metadata + README excerpt; not full source audit |
| `THU-MAIC/OpenMAIC` | [https://github.com/THU-MAIC/OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) | API metadata + README excerpt; not full source audit |
| `JetBrains/go-modern-guidelines` | [https://github.com/JetBrains/go-modern-guidelines](https://github.com/JetBrains/go-modern-guidelines) | API metadata + README excerpt; not full source audit |
| `Gitlawb/openclaude` | [https://github.com/Twigpine/openclaude](https://github.com/Twigpine/openclaude) | API metadata + README excerpt; not full source audit |
| `K-Dense-AI/scientific-agent-skills` | [https://github.com/K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) | API metadata + README excerpt; not full source audit |
| `jingyaogong/minimind` | [https://github.com/jingyaogong/minimind](https://github.com/jingyaogong/minimind) | API metadata + README excerpt; not full source audit |
| `google-research/timesfm` | [https://github.com/google-research/timesfm](https://github.com/google-research/timesfm) | API metadata + README excerpt; not full source audit |
| `EfficientStreet/hindsight` | [https://github.com/EfficientStreet/hindsight](https://github.com/EfficientStreet/hindsight) | API metadata + README excerpt; not full source audit |
| `timharris707/modeldeck` | [https://github.com/timharris707/modeldeck](https://github.com/timharris707/modeldeck) | API metadata + README excerpt; not full source audit |
| `Artistsyn/cortex_suite` | [https://github.com/Artistsyn/cortex_suite](https://github.com/Artistsyn/cortex_suite) | API metadata + README excerpt; not full source audit |
| `sulabhdubey/rta-smriti-brain` | [https://github.com/sulabhdubey/rta-smriti-brain](https://github.com/sulabhdubey/rta-smriti-brain) | API metadata + README excerpt; not full source audit |
| `EfficientStreet/youtube-subscriptions-ingest` | [https://github.com/EfficientStreet/youtube-subscriptions-ingest](https://github.com/EfficientStreet/youtube-subscriptions-ingest) | API metadata + README excerpt; not full source audit |
| `Kayforkind/reimagine-it` | [https://github.com/Kayforkind/reimagine-it](https://github.com/Kayforkind/reimagine-it) | API metadata + README excerpt; not full source audit |
| `templetongroup/radiant` | [https://github.com/templetongroup/radiant](https://github.com/templetongroup/radiant) | API metadata + README excerpt; not full source audit |
| `Onyx-Dev-Labs/doodle-note` | [https://github.com/Onyx-Dev-Labs/doodle-note](https://github.com/Onyx-Dev-Labs/doodle-note) | API metadata + README excerpt; not full source audit |
| `CapSoftware/Cap` | [https://github.com/CapSoftware/Cap](https://github.com/CapSoftware/Cap) | API metadata + README excerpt; not full source audit |
| `dani-garcia/vaultwarden` | [https://github.com/dani-garcia/vaultwarden](https://github.com/dani-garcia/vaultwarden) | API metadata + README excerpt; not full source audit |
| `TryGhost/Ghost` | [https://github.com/TryGhost/Ghost](https://github.com/TryGhost/Ghost) | API metadata + README excerpt; not full source audit |
| `twentyhq/twenty` | [https://github.com/twentyhq/twenty](https://github.com/twentyhq/twenty) | API metadata + README excerpt; not full source audit |
| `languagetool-org/languagetool` | [https://github.com/languagetool-org/languagetool](https://github.com/languagetool-org/languagetool) | API metadata + README excerpt; not full source audit |
| `umami-software/umami` | [https://github.com/umami-software/umami](https://github.com/umami-software/umami) | API metadata + README excerpt; not full source audit |
| `nextcloud/server` | [https://github.com/nextcloud/server](https://github.com/nextcloud/server) | API metadata + README excerpt; not full source audit |
| `chatwoot/chatwoot` | [https://github.com/chatwoot/chatwoot](https://github.com/chatwoot/chatwoot) | API metadata + README excerpt; not full source audit |
| `VonHoltenCodes/SlowBooksPro` | [https://github.com/VonHoltenCodes/SlowBooksPro](https://github.com/VonHoltenCodes/SlowBooksPro) | HTTP 404; unresolved (not proof of private/deleted/moved) |
| `ArnasDon/wacrm` | [https://github.com/ArnasDon/wacrm](https://github.com/ArnasDon/wacrm) | API metadata + README excerpt; not full source audit |
| `nwuzmedoutlook/university` | [https://github.com/nwuzmedoutlook/university](https://github.com/nwuzmedoutlook/university) | API metadata + README excerpt; not full source audit |
| `bugcrowd/bugcrowd_university` | [https://github.com/bugcrowd/bugcrowd_university](https://github.com/bugcrowd/bugcrowd_university) | API metadata + README excerpt; not full source audit |
| `cline/cline` | [https://github.com/cline/cline](https://github.com/cline/cline) | API metadata + README excerpt; not full source audit |
| `meta-models/meta-model-cookbook` | [https://github.com/meta-models/meta-model-cookbook](https://github.com/meta-models/meta-model-cookbook) | API metadata + README excerpt; not full source audit |
| `WEIFENG2333/VideoCaptioner` | [https://github.com/WEIFENG2333/VideoCaptioner](https://github.com/WEIFENG2333/VideoCaptioner) | API metadata + README excerpt; not full source audit |
| `ATH-MaaS/Pixelle-Video` | [https://github.com/ATH-MaaS/Pixelle-Video](https://github.com/ATH-MaaS/Pixelle-Video) | API metadata + README excerpt; not full source audit |
| `remotion-dev/remotion` | [https://github.com/remotion-dev/remotion](https://github.com/remotion-dev/remotion) | API metadata + README excerpt; not full source audit |
| `MarkTechStation/VideoCode` | [https://github.com/MarkTechStation/VideoCode](https://github.com/MarkTechStation/VideoCode) | API metadata + README excerpt; not full source audit |
| `3b1b/videos` | [https://github.com/3b1b/videos](https://github.com/3b1b/videos) | API metadata + README excerpt; not full source audit |
| `ytdl-org/youtube-dl` | [https://github.com/ytdl-org/youtube-dl](https://github.com/ytdl-org/youtube-dl) | API metadata + README excerpt; not full source audit |
| `bradautomates/claude-video` | [https://github.com/bradautomates/claude-video](https://github.com/bradautomates/claude-video) | API metadata + README excerpt; not full source audit |
| `MeiGen-AI/InfiniteTalk` | [https://github.com/MeiGen-AI/InfiniteTalk](https://github.com/MeiGen-AI/InfiniteTalk) | API metadata + README excerpt; not full source audit |
| `qdrzwd/VideoRecorder` | [https://github.com/qdrzwd/VideoRecorder](https://github.com/qdrzwd/VideoRecorder) | API metadata + README excerpt; not full source audit |
| `zai-org/CogVideo` | [https://github.com/zai-org/CogVideo](https://github.com/zai-org/CogVideo) | API metadata + README excerpt; not full source audit |
| `Tencent-Hunyuan/HunyuanVideo` | [https://github.com/Tencent-Hunyuan/HunyuanVideo](https://github.com/Tencent-Hunyuan/HunyuanVideo) | API metadata + README excerpt; not full source audit |
| `elebumm/RedditVideoMakerBot` | [https://github.com/elebumm/RedditVideoMakerBot](https://github.com/elebumm/RedditVideoMakerBot) | API metadata + README excerpt; not full source audit |
| `Lightricks/LTX-Video` | [https://github.com/Lightricks/LTX-Video](https://github.com/Lightricks/LTX-Video) | API metadata + README excerpt; not full source audit |
| `YaoFANGUK/video-subtitle-remover` | [https://github.com/YaoFANGUK/video-subtitle-remover](https://github.com/YaoFANGUK/video-subtitle-remover) | API metadata + README excerpt; not full source audit |
| `leandromoreira/digital_video_introduction` | [https://github.com/leandromoreira/digital_video_introduction](https://github.com/leandromoreira/digital_video_introduction) | API metadata + README excerpt; not full source audit |
| `OpenTalker/video-retalking` | [https://github.com/OpenTalker/video-retalking](https://github.com/OpenTalker/video-retalking) | API metadata + README excerpt; not full source audit |
| `meituan-longcat/LongCat-Video` | [https://github.com/meituan-longcat/LongCat-Video](https://github.com/meituan-longcat/LongCat-Video) | API metadata + README excerpt; not full source audit |
| `0voice/audio_video_streaming` | [https://github.com/0voice/audio_video_streaming](https://github.com/0voice/audio_video_streaming) | API metadata + README excerpt; not full source audit |
| `HITsz-TMG/VideoClaw` | [https://github.com/HITsz-TMG/VideoClaw](https://github.com/HITsz-TMG/VideoClaw) | API metadata + README excerpt; not full source audit |
| `jitsi/jitsi-videobridge` | [https://github.com/jitsi/jitsi-videobridge](https://github.com/jitsi/jitsi-videobridge) | API metadata + README excerpt; not full source audit |
| `HKUDS/VideoAgent` | [https://github.com/HKUDS/VideoAgent](https://github.com/HKUDS/VideoAgent) | API metadata + README excerpt; not full source audit |
| `LoSealL/VideoSuperResolution` | [https://github.com/LoSealL/VideoSuperResolution](https://github.com/LoSealL/VideoSuperResolution) | API metadata + README excerpt; not full source audit |
| `Augani/openreel-video` | [https://github.com/Augani/openreel-video](https://github.com/Augani/openreel-video) | API metadata + README excerpt; not full source audit |
| `Kosinkadink/ComfyUI-VideoHelperSuite` | [https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite](https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite) | API metadata + README excerpt; not full source audit |
| `dunossauro/videomaker-helper` | [https://github.com/dunossauro/videomaker-helper](https://github.com/dunossauro/videomaker-helper) | API metadata + README excerpt; not full source audit |
| `burhankocabiyik/videomaker` | [https://github.com/burhankocabiyik/videomaker](https://github.com/burhankocabiyik/videomaker) | API metadata + README excerpt; not full source audit |
| `wtz2017/VideoMaker` | [https://github.com/wtz2017/VideoMaker](https://github.com/wtz2017/VideoMaker) | API metadata + README excerpt; not full source audit |
| `viniciusenari/slideshow-videomaker` | [https://github.com/viniciusenari/slideshow-videomaker](https://github.com/viniciusenari/slideshow-videomaker) | API metadata + README excerpt; not full source audit |
| `WuTao-CS/VideoMaker` | [https://github.com/WuTao-CS/VideoMaker](https://github.com/WuTao-CS/VideoMaker) | API metadata + README excerpt; not full source audit |
| `shubhamdevhouse/Animated-VideoMaker` | [https://github.com/shubhamdevhouse/Animated-VideoMaker](https://github.com/shubhamdevhouse/Animated-VideoMaker) | API metadata + README excerpt; not full source audit |
| `seed0001/videoMaker` | [https://github.com/seed0001/videoMaker](https://github.com/seed0001/videoMaker) | API metadata + README excerpt; not full source audit |
| `Bilal-Belli/videoMakerBOT` | [https://github.com/Bilal-Belli/videoMakerBOT](https://github.com/Bilal-Belli/videoMakerBOT) | API metadata + README excerpt; not full source audit |
| `Nncstudio/VideoMakerPro` | [https://github.com/Nncstudio/VideoMakerPro](https://github.com/Nncstudio/VideoMakerPro) | API metadata + README excerpt; not full source audit |
| `mohamed11sk/Email-markting` | [https://github.com/mohamed11sk/Email-markting](https://github.com/mohamed11sk/Email-markting) | API metadata + README excerpt; not full source audit |
| `knsoftic/Email_Markting` | [https://github.com/knsoftic/Email_Markting](https://github.com/knsoftic/Email_Markting) | API metadata + README excerpt; not full source audit |
| `FoundationAgents/MetaGPT` | [https://github.com/FoundationAgents/MetaGPT](https://github.com/FoundationAgents/MetaGPT) | API metadata + README excerpt; not full source audit |
| `songguoxs/gpt4o-image-prompts` | [https://github.com/songguoxs/gpt4o-image-prompts](https://github.com/songguoxs/gpt4o-image-prompts) | API metadata + README excerpt; not full source audit |
| `ramon-victor/freegpt-webui` | [https://github.com/ramon-victor/freegpt-webui](https://github.com/ramon-victor/freegpt-webui) | API metadata + README excerpt; not full source audit |
| `Lin-jun-xiang/docGPT-langchain` | [https://github.com/Lin-jun-xiang/docGPT-langchain](https://github.com/Lin-jun-xiang/docGPT-langchain) | API metadata + README excerpt; not full source audit |
| `teremterem/claude-code-gpt-5-codex` | [https://github.com/teremterem/claude-code-gpt-5-codex](https://github.com/teremterem/claude-code-gpt-5-codex) | API metadata + README excerpt; not full source audit |
| `GetGoAPI/Free-GPT-Grok-Gemini-Claude-API` | [https://github.com/GetGoAPI/Free-GPT-Grok-Gemini-Claude-API](https://github.com/GetGoAPI/Free-GPT-Grok-Gemini-Claude-API) | API metadata + README excerpt; not full source audit |
| `zai-org/GLM-5` | [https://github.com/zai-org/GLM-5](https://github.com/zai-org/GLM-5) | API metadata + README excerpt; not full source audit |
| `GAIR-NLP/LiveTalk` | [https://github.com/GAIR-NLP/LiveTalk](https://github.com/GAIR-NLP/LiveTalk) | API metadata + README excerpt; not full source audit |
| `tinystruct/smalltalk` | [https://github.com/tinystruct/smalltalk](https://github.com/tinystruct/smalltalk) | API metadata + README excerpt; not full source audit |

## Implementation decisions informed by this review

- **Editorial Diagram & Button Design Studio (`cathrynlavery/diagram-design` v2.6, `tt-a1i/archify`, `omacom/omarchy`, `twentyhq/twenty`):** Implemented in `src/lib/diagram-design.ts`, `src/app/api/diagrams/route.ts`, `src/components/alo/DiagramStudioView.tsx`, and `src/components/alo/primitives.tsx` (`ArchifyToolbarButton`, `EditorialButton`, `SegmentedControl`, `HotkeyButton`). Supports 45 visual diagram types across 9 semantic patterns, 5 WCAG-verified skins (Editorial Light, Editorial Dark, Terminal `#0a0a0a`, Archify Evidence Console `#020617`, ALO Warm Gold), orthogonal `r=8` quarter-arc connector geometry, 6-rule geometry & WCAG 2.x contrast doctor, Mermaid redraw importer, and SVG/HTML/PNG export.
- **Marketing Kits, 50 Marketing Skills & Anti-AI-Slop Humanizer (`coreyhaines31/marketingskills`, `blader/humanizer`, `mohamed11sk/Email-markting`, `knsoftic/Email_Markting`):** Expanded in `src/lib/marketing-kits.ts`, `src/lib/humanizer.ts`, `src/app/api/marketing/humanize/route.ts`, and `src/components/alo/MarketingKitsView.tsx` to 16 full multi-channel campaign kits (covering UK/Canada/Australia/Germany, Pre-CAS, IELTS/PTE, Scholarship Audit, Offer Stack, fCMO 90-Day AARRR Plan, Partner B2B, Alumni Referral, Cold Outreach, Re-engagement), a searchable 50-Skill Marketing Catalog (`MARKETING_SKILLS_CATALOG`), and a real-time Humanizer v3.1.0 anti-AI-slop rewriter that preserves `{{merge_tags}}`.
- **Admissions CRM, 5-Country Studytra Planner, OpenProspector Waterfall & Bricks DataTable (`arupdas0825/studytra`, `Bhawana0218/NextStep-Abroad`, `Nabaleducation/EducationConsultancyWebsite`, `clawnify/OpenProspector`, `guifav/market-intelligence-radar`, `BraaMohammed/bricks`, `VonHoltenCodes/SlowBooks-Pro-2026`, `trycompai/crm`, `frappe/crm`, `idurar/idurar-erp-crm`, `twentyhq/twenty`):** Implemented in `src/components/alo/AdmissionsCRMView.tsx` and `src/components/alo/crm/AdmissionPipeline.tsx` with a Card/DataTable view switcher, 7-stage Kanban drag/click pipeline, itemized Quotations/Invoicing, a 5-Country Study-Abroad Execution Planner (UK, Canada, USA, Australia, Germany) with official portal links and timeline logging, and a 4-stage zero-markup OpenProspector waterfall enrichment tool.
- **OpenSEO, JSON-LD Schema.org, GEO AI Visibility & pSEO Matrix (`every-app/open-seo`, `coreyhaines31/marketingskills`):** Implemented in `src/components/alo/SeoView.tsx` with automatic `FAQPage` JSON-LD Schema.org generation, an interactive On-Page SEO & Generative Engine Optimization (GEO) 8-point auditor, and a Programmatic SEO (pSEO) Hub-and-Spoke Matrix generator.
- **Local Video, SRT Subtitles, Keyframe Stills & Voice/Music Studio (`WEIFENG2333/VideoCaptioner`, `harry0703/MoneyPrinterTurbo`, `heygen-com/hyperframes`, `Augani/openreel-video`, `remotion-dev/remotion`, `debpalash/VoiceStudio`):** Implemented in `src/components/alo/VideoPipelineView.tsx`, `src/components/alo/AudioStudioView.tsx`, `src/app/api/video/cinematic/route.ts`, `src/app/api/video/generate/route.ts`, `src/app/api/voice/generate/route.ts`, and `src/app/api/music/generate/route.ts` with verified local `ffmpeg`, `ffprobe`, `espeak`/`espeak-ng`, and `sharp` rendering 1080×1920 H.264 MP4s, `.srt` subtitles, PNG scene stills, and 24 kHz WAV speech/instrumentals.
- **Local-only AI/media generation and its runtime boundaries** are documented in [`LOCAL_AI.md`](../LOCAL_AI.md).

## Additional focused review — email, OTP, images and voice (2026-10-10)

These findings are targeted README/source excerpts, not full repository security or license audits. No third-party code or assets were copied.

- **httpSMS / `httpsms-node`:** the service is an HTTP SMS gateway, not an OTP policy/library. Its documented flow is an HTTP API queue → Firebase Cloud Messaging → a paired Android app/handset sends the carrier SMS; the service describes a Go/Fiber + CockroachDB API, a Nuxt/Vuetify web app hosted on Firebase, and a Kotlin Android app. Self-host instructions also require Firebase/FCM setup and other service configuration. The Node client is TypeScript and uses Axios; its API key is sent in `x-api-key`, and `POST /v1/messages/send` returns an accepted/queued response. An accepted response is not proof of handset delivery. This motivated a small first-party SMS-OTP adapter, with provider credentials fixed in server environment variables; no SMS was sent or delivery tested here. The external service/phone plan may incur charges.
- **VoiceStudio:** the current README describes an Electron desktop UI paired with a Python API/backend, Bun/Node/Rust development tooling, local downloadable speech models, and CUDA/Metal/CPU paths; model licenses are separate. The repository declares AGPL-3.0, and model/license and runtime implications remain unreviewed. It is much broader/heavier than this web app's Piper/eSpeak endpoint; no code was copied or runtime claimed.
- **RunningHub ComfyUI API plugin:** its README describes a ComfyUI node that submits workflows to RunningHub using an API key, with HTTP polling fallback for WebSocket interruption and cloud input/output transfer. It is not local inference merely because it is a ComfyUI plugin. It was not adopted because the project is configured for local-only image/video inference and no paid AI API use.
- **Email references:** the inspected PHP/PHPMailer and Laravel campaign projects have different stacks; one PHP README/source review exposed a hard-coded `root` DB account with an empty password, while the Laravel reference has no declared repository license in the reviewed metadata. Neither is safe to copy/deploy as-is. ALO now refines editable email draft copy locally but does not send email, manage a suppression/consent list, or implement an unsubscribe endpoint.

### Current implementation boundaries

- **OTP:** production admin login requires password + a short-lived single-use SMS code when the configured HTTP SMS gateway is ready; challenge and retry/rate limits are in the first-party app. Config absent → production auth fails closed. The sandbox did not make an SMS request or verify live delivery.
- **Email marketing:** writer → critic → finalist draft refinement, placeholder preservation, human review and pass logging; draft-only, no SMTP/Resend delivery.
- **Images:** three local prompt-refinement agents feed a locally configured ComfyUI/checkpoint. Missing model/backend still produces the documented SVG/image placeholder fallback, not AI art.
- **Voice:** optional three-agent narration-script draft followed by local TTS; direct speech synthesis accepts supplied text. Piper/eSpeak availability and model output have not been exercised in this sandbox.
- **Video:** local FFmpeg slideshow/motion-graphics output, still images (ComfyUI when configured), narration and a procedural instrumental; not frame-by-frame diffusion video or sung vocals. Media binaries/model checkpoints were not available to verify an end-to-end render in this audit.
- No “10× better” performance or output-quality claim is made. Quality scores are structural/editorial rubrics, not factual verification or measured comparative outcomes.
