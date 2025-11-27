import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../config';

const PackUploadPage = () => {
    const [file, setFile] = useState(null);
    const [uploadStatus, setUploadStatus] = useState('');
    const [error, setError] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const navigate = useNavigate();

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (selectedFile && selectedFile.type === 'application/json') {
            setFile(selectedFile);
            setError('');
            setUploadProgress(0);
        } else {
            setError('Please select a valid JSON file');
            setFile(null);
            setUploadProgress(0);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file first');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setError('');
        setUploadStatus('');

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const jsonData = JSON.parse(e.target.result);

                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', `${config.apiUrl}/api/pack/upload`, true);
                    xhr.setRequestHeader('Content-Type', 'application/json');

                    xhr.upload.onprogress = (event) => {
                        if (event.lengthComputable) {
                            const progress = Math.round((event.loaded * 100) / event.total);
                            setUploadProgress(progress);
                        }
                    };

                    xhr.onload = () => {
                        if (xhr.status === 200) {
                            setUploadStatus('Pack uploaded successfully!');
                            setError('');
                        } else {
                            const result = JSON.parse(xhr.responseText);
                            setError(result.error || 'Failed to upload pack');
                            setUploadStatus('');
                        }
                        setIsUploading(false);
                    };

                    xhr.onerror = () => {
                        setError('Network error occurred');
                        setUploadStatus('');
                        setIsUploading(false);
                    };

                    xhr.send(JSON.stringify(jsonData));
                } catch (parseError) {
                    console.log(parseError);
                    setError('Invalid JSON format');
                    setUploadStatus('');
                    setIsUploading(false);
                }
            };

            reader.onerror = () => {
                setError('Error reading file');
                setUploadStatus('');
                setIsUploading(false);
            };

            reader.readAsText(file);
        } catch (error) {
            setError('Error uploading file');
            setUploadStatus('');
            setIsUploading(false);
        }
    };

    return (
        <div className="fade-in" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem'
        }}>
            <div className="glass-panel" style={{
                padding: '3rem',
                width: '100%',
                maxWidth: '600px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2rem'
            }}>
                <button
                    onClick={() => navigate('/admin')}
                    className="btn-primary"
                    style={{
                        alignSelf: 'flex-start',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-primary)',
                        boxShadow: 'none',
                        border: '1px solid var(--glass-border)'
                    }}
                >
                    Back to Admin
                </button>

                <h1 className="text-gradient" style={{
                    fontSize: '3rem',
                    fontWeight: '800',
                    margin: 0,
                    textAlign: 'center'
                }}>
                    Upload New Pack
                </h1>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem'
                }}>
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '0.75rem',
                            color: 'var(--text-secondary)',
                            fontSize: '0.875rem',
                            fontWeight: '500'
                        }}>
                            Select Pack File (JSON)
                        </label>
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleFileChange}
                            disabled={isUploading}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '1rem',
                                cursor: isUploading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s'
                            }}
                        />
                        {file && (
                            <div style={{
                                marginTop: '0.75rem',
                                padding: '0.5rem 1rem',
                                background: 'rgba(34, 211, 238, 0.1)',
                                border: '1px solid var(--accent)',
                                borderRadius: '8px',
                                color: 'var(--accent)',
                                fontSize: '0.875rem'
                            }}>
                                Selected: {file.name}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleUpload}
                        disabled={!file || isUploading}
                        className="btn-primary"
                        style={{
                            width: '100%',
                            opacity: (!file || isUploading) ? 0.5 : 1,
                            cursor: (!file || isUploading) ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {isUploading ? 'Uploading...' : 'Upload Pack'}
                    </button>

                    {isUploading && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem'
                        }}>
                            <div style={{
                                width: '100%',
                                height: '12px',
                                background: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '999px',
                                overflow: 'hidden',
                                border: '1px solid var(--glass-border)'
                            }}>
                                <div
                                    style={{
                                        width: `${uploadProgress}%`,
                                        height: '100%',
                                        background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                                        transition: 'width 0.3s ease',
                                        boxShadow: '0 0 10px var(--primary-glow)'
                                    }}
                                />
                            </div>
                            <div style={{
                                textAlign: 'center',
                                color: 'var(--text-secondary)',
                                fontSize: '0.875rem',
                                fontWeight: '600'
                            }}>
                                {uploadProgress}%
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <div style={{
                        padding: '1rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid #ef4444',
                        borderRadius: '8px',
                        color: '#ef4444',
                        fontSize: '0.875rem',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                {uploadStatus && (
                    <div style={{
                        padding: '1rem',
                        background: 'rgba(34, 197, 94, 0.1)',
                        border: '1px solid #22c55e',
                        borderRadius: '8px',
                        color: '#22c55e',
                        fontSize: '0.875rem',
                        textAlign: 'center'
                    }}>
                        {uploadStatus}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PackUploadPage;
