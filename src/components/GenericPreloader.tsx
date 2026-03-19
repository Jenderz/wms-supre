import React from 'react';

export const GenericPreloader = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gray-50 dark:bg-black transition-colors duration-500">
      <div className="flex flex-col items-center gap-8 animate-fade-in p-6">
        {/* Animación de Carga Central Minimalista */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          {/* Anillo exterior sutil */}
          <div className="absolute inset-0 border-2 border-gray-100 dark:border-white/5 rounded-full"></div>
          {/* Anillo de carga fino */}
          <div className="absolute inset-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          {/* Logo Central */}
          <div className="absolute inset-0 flex items-center justify-center p-5">
            <img 
              src="https://orgemac.com/api/uploads/img_1767849584_a1254615.png" 
              alt="Lyberate" 
              className="w-full h-full object-contain opacity-90" 
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
        {/* Texto de Marca Minimalista */}
        <div className="text-center space-y-4">
          <h1 className="text-xs md:text-sm font-light text-gray-500 dark:text-gray-400 tracking-[0.4em] uppercase">
            Tecnología Lyberate
          </h1>
          {/* Puntos de carga sutiles */}
          <div className="flex justify-center gap-1.5 opacity-30">
            <span className="w-0.5 h-0.5 bg-gray-400 dark:bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-0.5 h-0.5 bg-gray-400 dark:bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-0.5 h-0.5 bg-gray-400 dark:bg-white rounded-full animate-bounce"></span>
          </div>
        </div>
      </div>
    </div>
  );
};
