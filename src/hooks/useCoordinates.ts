import { useState } from 'react';
import { Coordinates, TransformState } from '../types.ts';

export const useCoordinates = () => {
  const [coordinates, setCoordinates] = useState<Coordinates>({ x: 0, y: 0 });
  const [transformState, setTransformState] = useState<TransformState>({ 
    scale: 1, 
    positionX: 0, 
    positionY: 0 
  });

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const { scale, positionX, positionY } = transformState;
    const x = (event.clientX - positionX) / scale;
    const y = (event.clientY - positionY) / scale;
    setCoordinates({ x, y });
  };

  const handleScaleChange = (event: any) => {
    const { scale, positionX, positionY } = event.instance.transformState;
    setTransformState({ scale, positionX, positionY });
  };

  return {
    coordinates,
    transformState,
    handleMouseMove,
    handleScaleChange
  };
};

