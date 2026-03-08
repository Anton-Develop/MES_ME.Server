// history.js
import { createBrowserHistory } from 'history';

// Создаем экземпляр history
export const history = createBrowserHistory();

// Функция для программного навигатора
let navigateFunction;

export const setNavigate = (navigate) => {
    navigateFunction = navigate;
};

export const navigateTo = (path) => {
    if (navigateFunction) {
        navigateFunction(path);
    } else {
        // Резервный вариант, если navigate не установлен
        console.warn("Navigate function not set, using window.location");
        window.location.href = path;
    }
};