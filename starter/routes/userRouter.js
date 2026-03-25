'use strict';

const express = require('express');
const {
  getAllUsers,
  //createUser, commented out because we are not using it, and instead using signup
  getUserById,
  updateUser,
  deleteUser,
  updateMe,
  deleteMe,
  getMe,
  uploadUserPhoto,
  resizeUserPhoto,
} = require('../controllers/userController');

const {
  signup,
  login,
  forgotPassword,
  resetPassword,
  updatePassword,
  protect,
  restrictTo,
  logout,
} = require('../controllers/authController');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/logout', logout);
router.post('/forgotPassword', forgotPassword);
router.patch('/resetPassword/:token', resetPassword);

router.use(protect);
router.patch('/updateMyPassword', updatePassword);

router.patch('/updateMe', uploadUserPhoto, resizeUserPhoto, updateMe);
router.delete('/deleteMe', deleteMe);
router.get('/me', getMe, getUserById);

router.use(restrictTo('admin'));
router.route('/').get(getAllUsers);
router.route('/:id').get(getUserById).patch(updateUser).delete(deleteUser);
module.exports = router;
