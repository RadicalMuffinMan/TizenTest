/* global webapis, localStorage */
/**
 * Device Profile Service - Detects Samsung Tizen TV hardware capabilities
 *
 * Uses Tizen webapis to detect panel resolution, HDR support, codec support, etc.
 */

let cachedCapabilities = null;

export const clearCapabilitiesCache = () => {
	cachedCapabilities = null;
};

export const detectTizenVersion = () => {
	if (typeof webapis === 'undefined' || !webapis.productinfo) {
		return 4; // Default assumption
	}

	try {
		const firmware = webapis.productinfo.getFirmware();
		// Try to extract year from firmware string
		const match = firmware?.match(/(\d{4})/);
		if (match) {
			const year = parseInt(match[1], 10);
			// Map TV years to Tizen versions
			if (year >= 2024) return 8;
			if (year >= 2023) return 7;
			if (year >= 2022) return 6.5;
			if (year >= 2021) return 6;
			if (year >= 2020) return 5.5;
			if (year >= 2019) return 5;
			if (year >= 2018) return 4;
			if (year >= 2017) return 3;
			if (year >= 2016) return 2.4;
		}
	} catch (e) {
		console.log('[deviceProfile] Could not detect Tizen version');
	}

	return 4;
};

const getDocumentedContainerSupport = (tizenVersion) => {
	// Samsung Tizen TVs have good container support
	return {
		mp4: true,
		m4v: true,
		ts: true,
		mov: true,
		avi: tizenVersion >= 3,
		webm: tizenVersion >= 4,
		mkv: true,
		hls: true
	};
};

export const testHevcSupport = (tizenVersion = 4) => {
	return tizenVersion >= 3;
};

export const testAv1Support = (tizenVersion = 4) => {
	return tizenVersion >= 6;
};

export const testVp9Support = (tizenVersion = 4) => {
	return tizenVersion >= 4;
};

export const testDtsSupport = () => true;

export const testAc3Support = () => true;

export const getDeviceCapabilities = async () => {
	if (cachedCapabilities) return cachedCapabilities;

	const tizenVersion = detectTizenVersion();
	const containerSupport = getDocumentedContainerSupport(tizenVersion);

	let modelName = 'Samsung TV';
	let serialNumber = '';
	let deviceId = '';
	let uhd = true;
	let uhd8K = false;
	let hdr10 = tizenVersion >= 4;
	let dolbyVision = tizenVersion >= 5;

	if (typeof webapis !== 'undefined') {
		try {
			if (webapis.productinfo) {
				if (typeof webapis.productinfo.getModel === 'function') {
					modelName = webapis.productinfo.getModel();
				}
				if (typeof webapis.productinfo.getRealModel === 'function') {
					modelName = webapis.productinfo.getRealModel();
				}
				if (typeof webapis.productinfo.getDuid === 'function') {
					deviceId = webapis.productinfo.getDuid();
				}

				// Check resolution support
				if (typeof webapis.productinfo.is8KPanelSupported === 'function' &&
					webapis.productinfo.is8KPanelSupported()) {
					uhd8K = true;
					uhd = true;
				} else if (typeof webapis.productinfo.isUdPanelSupported === 'function') {
					uhd = webapis.productinfo.isUdPanelSupported();
				}
			}

			// Check HDR support
			if (webapis.avinfo) {
				if (typeof webapis.avinfo.isHdrTvSupport === 'function') {
					hdr10 = webapis.avinfo.isHdrTvSupport();
				}
				if (typeof webapis.avinfo.isDolbyVisionSupport === 'function') {
					dolbyVision = webapis.avinfo.isDolbyVisionSupport();
				}
			}
		} catch (e) {
			console.log('[deviceProfile] Error getting Tizen capabilities:', e);
		}
	}

	cachedCapabilities = {
		modelName,
		modelNameAscii: modelName,
		serialNumber,
		deviceId,
		firmwareVersion: '',

		tizenVersion,
		tizenVersionDisplay: `Tizen ${tizenVersion}`,

		screenWidth: uhd8K ? 7680 : uhd ? 3840 : 1920,
		screenHeight: uhd8K ? 4320 : uhd ? 2160 : 1080,
		uhd,
		uhd8K,
		oled: false, // Can't detect reliably on Tizen

		hdr10,
		hdr10Plus: tizenVersion >= 5,
		hlg: tizenVersion >= 4,
		dolbyVision,

		dolbyAtmos: tizenVersion >= 4,
		dts: testDtsSupport(),
		ac3: testAc3Support(),
		eac3: true,
		truehd: tizenVersion >= 5,

		hevc: testHevcSupport(tizenVersion),
		av1: testAv1Support(tizenVersion),
		vp9: testVp9Support(tizenVersion),

		...containerSupport,

		nativeHls: true,
		nativeHlsFmp4: true,
		hlsAc3: true
	};

	console.log('[deviceProfile] Tizen Capabilities:', cachedCapabilities);
	return cachedCapabilities;
};

export const getJellyfinDeviceProfile = async () => {
	const caps = await getDeviceCapabilities();

	const videoCodecs = ['h264'];
	if (caps.hevc) videoCodecs.push('hevc');
	if (caps.vp9) videoCodecs.push('vp9');
	if (caps.av1) videoCodecs.push('av1');

	const audioCodecs = ['aac', 'mp3', 'flac', 'opus', 'vorbis', 'pcm', 'wav'];
	if (caps.ac3) audioCodecs.push('ac3');
	if (caps.eac3) audioCodecs.push('eac3');
	if (caps.dts) audioCodecs.push('dts', 'dca');
	if (caps.truehd) audioCodecs.push('truehd');

	const videoContainers = [];
	if (caps.mp4) videoContainers.push('mp4');
	if (caps.m4v) videoContainers.push('m4v');
	if (caps.webm) videoContainers.push('webm');
	if (caps.ts) videoContainers.push('ts', 'mpegts');
	if (caps.mkv) videoContainers.push('mkv', 'matroska');
	if (caps.mov) videoContainers.push('mov');

	console.log('[deviceProfile] DirectPlayProfiles:', [{Container: videoContainers.join(','), VideoCodec: videoCodecs.join(','), AudioCodec: audioCodecs.join(',')}]);

	const maxBitrate = caps.uhd8K ? 200000000 : caps.uhd ? 120000000 : 80000000;
	const maxAudioChannels = caps.dolbyAtmos ? '8' : '6';

	const directPlayProfiles = [
		{
			Container: videoContainers.join(','),
			Type: 'Video',
			VideoCodec: videoCodecs.join(','),
			AudioCodec: audioCodecs.join(',')
		},
		{
			Container: 'mp3,flac,aac,m4a,ogg,opus,wav,wma',
			Type: 'Audio'
		}
	];

	if (caps.nativeHls) {
		directPlayProfiles.push({
			Container: 'm3u8',
			Type: 'Video',
			VideoCodec: videoCodecs.join(','),
			AudioCodec: audioCodecs.join(',')
		});
	}

	const transcodingProfiles = [
		{
			Container: 'ts',
			Type: 'Video',
			AudioCodec: caps.ac3 ? 'aac,ac3,eac3' : 'aac',
			VideoCodec: caps.hevc ? 'hevc,h264' : 'h264',
			Context: 'Streaming',
			Protocol: 'hls',
			MaxAudioChannels: maxAudioChannels,
			MinSegments: '1',
			SegmentLength: '3',
			BreakOnNonKeyFrames: true
		},
		{
			Container: 'mp4',
			Type: 'Video',
			AudioCodec: 'aac,ac3',
			VideoCodec: 'h264',
			Context: 'Static'
		},
		{
			Container: 'mp3',
			Type: 'Audio',
			AudioCodec: 'mp3',
			Context: 'Streaming',
			Protocol: 'http'
		}
	];

	const codecProfiles = [
		{
			Type: 'Video',
			Codec: 'h264',
			Conditions: [
				{
					Condition: 'NotEquals',
					Property: 'IsAnamorphic',
					Value: 'true',
					IsRequired: false
				},
				{
					Condition: 'LessThanEqual',
					Property: 'VideoLevel',
					Value: caps.uhd ? '51' : '41',
					IsRequired: false
				},
				{
					Condition: 'LessThanEqual',
					Property: 'VideoBitDepth',
					Value: '8',
					IsRequired: false
				},
				{
					Condition: 'LessThanEqual',
					Property: 'RefFrames',
					Value: '16',
					IsRequired: false
				}
			]
		},
		{
			Type: 'Video',
			Codec: 'hevc',
			Conditions: [
				{
					Condition: 'LessThanEqual',
					Property: 'VideoLevel',
					Value: caps.uhd ? '153' : '120',
					IsRequired: false
				},
				{
					Condition: 'LessThanEqual',
					Property: 'VideoBitDepth',
					Value: caps.hdr10 || caps.dolbyVision ? '10' : '8',
					IsRequired: false
				}
			]
		},
		{
			Type: 'Audio',
			Conditions: [
				{
					Condition: 'LessThanEqual',
					Property: 'AudioChannels',
					Value: maxAudioChannels,
					IsRequired: false
				}
			]
		}
	];

	if (caps.av1) {
		codecProfiles.push({
			Type: 'Video',
			Codec: 'av1',
			Conditions: [
				{
					Condition: 'LessThanEqual',
					Property: 'VideoLevel',
					Value: '15',
					IsRequired: false
				},
				{
					Condition: 'LessThanEqual',
					Property: 'VideoBitDepth',
					Value: '10',
					IsRequired: false
				}
			]
		});
	}

	const subtitleProfiles = [
		{Format: 'srt', Method: 'External'},
		{Format: 'ass', Method: 'External'},
		{Format: 'ssa', Method: 'External'},
		{Format: 'vtt', Method: 'External'},
		{Format: 'sub', Method: 'External'},
		{Format: 'smi', Method: 'External'},
		{Format: 'ttml', Method: 'External'},
		{Format: 'pgs', Method: 'Embed'},
		{Format: 'dvdsub', Method: 'Embed'},
		{Format: 'dvbsub', Method: 'Embed'}
	];

	const responseProfiles = [
		{
			Type: 'Video',
			Container: 'm4v',
			MimeType: 'video/mp4'
		},
		{
			Type: 'Video',
			Container: 'mkv',
			MimeType: 'video/x-matroska'
		}
	];

	return {
		Name: `Moonfin Tizen ${caps.tizenVersion}`,
		MaxStreamingBitrate: maxBitrate,
		MaxStaticBitrate: maxBitrate,
		MaxStaticMusicBitrate: 40000000,
		MusicStreamingTranscodingBitrate: 384000,
		DirectPlayProfiles: directPlayProfiles,
		TranscodingProfiles: transcodingProfiles,
		CodecProfiles: codecProfiles,
		SubtitleProfiles: subtitleProfiles,
		ResponseProfiles: responseProfiles
	};
};

export const getDeviceId = () => {
	// Try to get Tizen device ID first
	if (typeof webapis !== 'undefined' && webapis.productinfo) {
		try {
			const duid = webapis.productinfo.getDuid();
			if (duid) return duid;
		} catch (e) {
			// Fall through to localStorage
		}
	}

	let deviceId = localStorage.getItem('moonfin_device_id');
	if (!deviceId) {
		deviceId = 'moonfin_tizen_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
		localStorage.setItem('moonfin_device_id', deviceId);
	}
	return deviceId;
};

export const getDeviceName = async () => {
	const caps = await getDeviceCapabilities();
	return caps.modelName || `Samsung TV Tizen ${caps.tizenVersion}`;
};

export default {
	detectTizenVersion,
	getDeviceCapabilities,
	getJellyfinDeviceProfile,
	getDeviceId,
	getDeviceName
};
