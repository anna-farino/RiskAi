import { RouteObject } from 'react-router-dom';
import NewsCapsuleHome from '../index';

export const newsCapsuleRouter: RouteObject = {
  path: 'news-capsule',
  element: <NewsCapsuleHome />,
  children: []
};