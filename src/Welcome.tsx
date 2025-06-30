import React, { useState } from 'react';
import './css/PopupWelcome.css'; // Make sure to create and import the CSS file
import { initializeDatabase } from './helpers/database.ts';
import { setDatabaseProps } from './types.ts';

const PopupWelcome: React.FC<setDatabaseProps> = ({ setDatabase }) => {
  const [fileName, setFileName] = useState<string>(''); 
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.style.backgroundColor = '#EF5A00';
    event.currentTarget.style.color = '#fff';
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.currentTarget.style.backgroundColor = '#fff';
    event.currentTarget.style.color = '#EF5A00';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.style.backgroundColor = '#fff';
    event.currentTarget.style.color = '#EF5A00';
    const files = event.dataTransfer.files;
    if (files.length > 1) {
      alert('Please upload only one file.');
      return;
    }
    displayFile(files[0]);
  };

  const handleClick = () => {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput.click();
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 1) {
      alert('Please upload only one file.');
      event.target.value = '';
      return;
    }
    if (files) {
      displayFile(files[0]);
    }
  };

  const displayFile = (file: File) => {
    setFileName(`Uploaded File: ${file.name}`);
  };

  return (
    <div id="popup-welcome" className="popup">
      <div className="backgroundImg"></div>
      <div className="outer-popup"></div>
      <div className="inner-popup">
        <div className="confetti">
          {[...Array(9)].map((_, index) => (
            <div key={index} style={{ left: `${10 * (index + 1)}%`, animationDelay: `${0.5 * index}s` }}></div>
          ))}
        </div>
        <img src="logo/logo2.png" style={{ width: '400px' }} alt="Logo" />
        <h3>Welcome, please upload DB File below</h3>
        <div
          className="file-drop"
          id="fileDrop"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <label htmlFor="fileInput">Drop a file here or click to upload</label>
          <input type="file" id="fileInput" accept=".db,.sqlite" onChange={handleChange} style={{ display: 'none' }} />
          <div className="file-name">{fileName}</div>
        </div>
        <button type="button" className="button" onClick={() => initializeDatabase(setDatabase)} id="start">Start</button>
      </div>
    </div>
  );
};

export default PopupWelcome;
